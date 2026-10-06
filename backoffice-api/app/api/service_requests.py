import os
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

import jwt
import requests
from flask import current_app, g, jsonify, request
from sqlalchemy import func

from . import api
from .decorators import admin_required, login_required
from .orders import _internal_headers
from .. import db
from ..models import (CarrierCompany, CarrierCompanyServiceType, ServiceRequest,
                      ServiceRequestItem, ServiceRequestMedia, ServiceRequestNotification,
                      ServiceRequestQuotation, ServiceMaterial, ServiceType, _iso, _money)

STATUSES = ('draft', 'submitted', 'cancelled')
TOKEN_PURPOSE = 'service_request'
TOKEN_TTL = timedelta(days=10)
LIST_LIMIT = 200


def _generate_token(service_request_id, carrier_company_id):
    """Mismo token que firma el API principal al avisar al transportista (ver
    app/api/service_request/notifications.py). Acá se firma para el admin que
    copia el link a mano, y se verifica el que llega por email o WhatsApp."""
    now = datetime.now(timezone.utc)
    payload = {
        'purpose': TOKEN_PURPOSE,
        'service_request_id': service_request_id,
        'carrier_company_id': carrier_company_id,
        'iat': now,
        'exp': now + TOKEN_TTL,
    }
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')


def _materials_summary(service_request):
    """Por material: en cuántas cosas se pidió y cuántas unidades suman. Es lo que
    el transportista mira para calcular cuánto material llevar."""
    summary = {}
    for item in service_request.items:
        for material in item.materials:
            entry = summary.setdefault(material.code, {
                'code': material.code, 'name': material.name, 'position': material.position,
                'items': 0, 'quantity': 0,
            })
            entry['items'] += 1
            entry['quantity'] += item.quantity
    ordered = sorted(summary.values(), key=lambda e: (e['position'], e['code']))
    return [{k: v for k, v in entry.items() if k != 'position'} for entry in ordered]


def _platform_fee_rate():
    """La comision vigente, con el mismo default que usan las ordenes en este API."""
    return Decimal(os.environ.get('PLATFORM_FEE', '0.1'))


def _total_with_fee(amount, rate):
    """monto * (1 + comision), a 2 decimales. Misma cuenta que congela el API
    principal al elegir una cotizacion (quotations.total_with_fee)."""
    return (Decimal(amount) * (1 + Decimal(rate))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def _quotation_for_admin(quotation, current_rate):
    """La cotizacion con su total para el cliente: el congelado si ya fue elegida,
    y si no el que saldria hoy con la comision vigente."""
    data = quotation.to_dict()
    if quotation.status == 'selected' and quotation.total_amount is not None:
        data['total_amount'] = _money(quotation.total_amount)
    else:
        data['total_amount'] = _money(_total_with_fee(quotation.amount, current_rate))
        data['platform_fee_rate'] = float(current_rate)
    return data


def _quotation_state(service_request, carrier_company_id):
    """Que puede hacer este transportista con la solicitud."""
    if service_request.status == 'cancelled':
        return 'cancelled'
    selected = next((q for q in service_request.quotations if q.status == 'selected'), None)
    if selected is None:
        return 'open'
    return 'selected_mine' if selected.carrier_company_id == carrier_company_id else 'selected_other'


def _resolve_carrier_link(token):
    """Valida el link del transportista. Devuelve (solicitud, carrier_company_id, None)
    o (None, None, respuesta de error).

    Un token malo, de otro proposito o de una solicitud que no existe es 404, y uno
    vencido es 410. Nunca 401: el interceptor de axios del backoffice manda a /login
    ante un 401, y esta pagina la abre gente sin cuenta.
    """
    try:
        payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return None, None, (jsonify({'message': 'link expired'}), 410)
    except jwt.InvalidTokenError:
        return None, None, (jsonify({'message': 'invalid link'}), 404)
    if payload.get('purpose') != TOKEN_PURPOSE:
        return None, None, (jsonify({'message': 'invalid link'}), 404)

    service_request = db.session.get(ServiceRequest, payload.get('service_request_id'))
    # Un borrador no se aviso a nadie: si el link llega a uno, no existe todavia.
    if service_request is None or service_request.status == 'draft':
        return None, None, (jsonify({'message': 'invalid link'}), 404)
    return service_request, payload.get('carrier_company_id'), None


@api.route('/service-types', methods=['GET'])
@login_required
def list_service_types():
    types = ServiceType.query.filter_by(active=1).order_by(ServiceType.id).all()
    return jsonify({'service_types': [t.to_dict() for t in types]}), 200


@api.route('/service-types/<code>/materials', methods=['GET'])
@login_required
def list_service_materials(code):
    """Catálogo de materiales del servicio, para el formulario de alta manual."""
    service_type = ServiceType.query.filter_by(code=code, active=1).first()
    if service_type is None:
        return jsonify({'message': 'service type not found'}), 404
    materials = (
        ServiceMaterial.query.filter_by(service_type_id=service_type.id, active=1)
        .order_by(ServiceMaterial.position, ServiceMaterial.id).all()
    )
    return jsonify({'materials': [
        {'code': m.code, 'name': m.name, 'description': m.description} for m in materials
    ]}), 200


@api.route('/service-requests', methods=['POST'])
@admin_required
def create_service_request():
    """Anota a mano una solicitud que el cliente describió por WhatsApp o llamada.

    Las reglas (dirección con link de mapa, materiales del catálogo, fecha, avisos a
    los transportistas) viven en el API principal, dueña de los correos y los
    WhatsApp; acá solo se controla el rol y se reenvía el cuerpo. Los 400 de la
    validación se devuelven tal cual para que el formulario diga qué falta.
    """
    internal_api = os.getenv('INTERNAL_API_URL', 'http://flask-api:8001')
    try:
        res = requests.post(
            f'{internal_api}/api/v1/service-requests/manual',
            json=request.get_json(silent=True) or {},
            headers=_internal_headers(),
            timeout=30,
        )
    except requests.RequestException:
        return jsonify({'message': 'could not reach the service request service'}), 502
    if res.status_code not in (201, 400):
        return jsonify({'message': 'failed to create the service request'}), 502
    return jsonify(res.json()), res.status_code


def _counts(model, request_ids):
    """Cantidad de filas de `model` por solicitud, en una sola consulta."""
    if not request_ids:
        return {}
    rows = (
        db.session.query(model.service_request_id, func.count())
        .filter(model.service_request_id.in_(request_ids))
        .group_by(model.service_request_id).all()
    )
    return dict(rows)


@api.route('/service-requests', methods=['GET'])
@admin_required
def list_service_requests():
    query = ServiceRequest.query
    status = request.args.get('status')
    if status:
        if status not in STATUSES:
            return jsonify({'message': 'invalid status'}), 400
        query = query.filter_by(status=status)
    service_type = request.args.get('service_type')
    if service_type:
        query = query.join(ServiceType).filter(ServiceType.code == service_type)
    rows = query.order_by(ServiceRequest.id.desc()).limit(LIST_LIMIT).all()

    ids = [r.id for r in rows]
    items = _counts(ServiceRequestItem, ids)
    media = _counts(ServiceRequestMedia, ids)
    notified = _counts(ServiceRequestNotification, ids)
    quotations = {}
    if ids:
        for request_id, count, lowest in (
            db.session.query(ServiceRequestQuotation.service_request_id, func.count(),
                             func.min(ServiceRequestQuotation.amount))
            .filter(ServiceRequestQuotation.service_request_id.in_(ids))
            .group_by(ServiceRequestQuotation.service_request_id).all()
        ):
            quotations[request_id] = (count, _money(lowest))
    return jsonify({'service_requests': [
        {
            'id': r.id,
            'service_type': r.service_type.to_dict() if r.service_type else None,
            'status': r.status,
            'preferred_date': r.preferred_date.isoformat() if r.preferred_date else None,
            'neighborhood': r.neighborhood,
            'items_count': items.get(r.id, 0),
            'media_count': media.get(r.id, 0),
            'notified_count': notified.get(r.id, 0),
            'quotations_count': quotations.get(r.id, (0, None))[0],
            'min_amount': quotations.get(r.id, (0, None))[1],
            'created_date': _iso(r.created_date),
            'submitted_at': _iso(r.submitted_at),
        }
        for r in rows
    ]}), 200


@api.route('/service-requests/<int:service_request_id>', methods=['GET'])
@admin_required
def get_service_request(service_request_id):
    service_request = db.session.get(ServiceRequest, service_request_id)
    if service_request is None:
        return jsonify({'message': 'service request not found'}), 404

    # Los transportistas que ofrecen el servicio, con su link, igual que
    # get_quotation_links en las órdenes: el admin lo copia y lo manda a mano.
    offering = (
        CarrierCompany.query
        .join(CarrierCompanyServiceType, CarrierCompanyServiceType.carrier_company_id == CarrierCompany.id)
        .filter(CarrierCompanyServiceType.service_type_id == service_request.service_type_id,
                CarrierCompany.active == 1)
        .order_by(CarrierCompany.name).all()
    )
    notified_ids = {n.carrier_company_id for n in service_request.notifications}
    current_rate = _platform_fee_rate()
    return jsonify({'service_request': {
        **service_request.to_dict_full(),
        'materials_summary': _materials_summary(service_request),
        'notifications': [n.to_dict() for n in service_request.notifications],
        'platform_fee_rate': float(current_rate),
        'quotations': [
            _quotation_for_admin(q, current_rate)
            for q in sorted(service_request.quotations, key=lambda q: (q.amount, q.id))
        ],
        'links': [
            {
                'id': c.id,
                'name': c.name,
                'token': _generate_token(service_request.id, c.id),
                'notified': c.id in notified_ids,
            }
            for c in offering
        ],
    }}), 200


@api.route('/service-requests/<int:service_request_id>/notify-carriers', methods=['POST'])
@admin_required
def notify_service_request_carriers(service_request_id):
    """Reenvía a los transportistas que aún no recibieron la solicitud.

    El envío lo hace el API principal, dueño de los correos y los WhatsApp;
    acá solo se controla el rol. Los 404 y 409 (aún borrador) se devuelven tal
    cual para que la pantalla diga qué pasó.
    """
    internal_api = os.getenv('INTERNAL_API_URL', 'http://flask-api:8001')
    try:
        res = requests.post(
            f'{internal_api}/api/v1/service-requests/{service_request_id}/notify-carriers',
            headers=_internal_headers(),
            timeout=30,
        )
    except requests.RequestException:
        return jsonify({'message': 'could not reach the service request service'}), 502
    if res.status_code not in (200, 404, 409):
        return jsonify({'message': 'failed to notify carriers'}), 502
    return jsonify(res.json()), res.status_code


@api.route('/service-requests/<int:service_request_id>', methods=['PATCH'])
@admin_required
def update_service_request(service_request_id):
    service_request = db.session.get(ServiceRequest, service_request_id)
    if service_request is None:
        return jsonify({'message': 'service request not found'}), 404
    data = request.get_json(silent=True) or {}
    # Cancelar es lo único que se puede hacer desde acá: el resto de los datos
    # los escribe el cliente, y no se editan a sus espaldas.
    if data.get('status') != 'cancelled':
        return jsonify({'message': "only status 'cancelled' can be set"}), 400
    service_request.status = 'cancelled'
    db.session.commit()
    return jsonify({'service_request': service_request.to_dict_full()}), 200


@api.route('/public/service-requests/<token>', methods=['GET'])
def get_service_request_for_carrier(token):
    """La solicitud tal como la ve el transportista que recibio el link. Sin login."""
    service_request, carrier_company_id, error = _resolve_carrier_link(token)
    if error:
        return error
    carrier = db.session.get(CarrierCompany, carrier_company_id)
    mine = next((q for q in service_request.quotations if q.carrier_company_id == carrier_company_id), None)

    # to_dict() no incluye el WhatsApp del cliente a proposito: el transportista
    # responde a Chalan, no al cliente. Tampoco se expone ninguna cotizacion ajena:
    # solo la suya y un estado.
    return jsonify({'service_request': {
        **service_request.to_dict(),
        'materials_summary': _materials_summary(service_request),
        'carrier_company_name': carrier.name if carrier else None,
        'quotation_state': _quotation_state(service_request, carrier_company_id),
        'my_quotation': None if mine is None else {
            'amount': _money(mine.amount),
            'note': mine.note,
            'status': mine.status,
            'updated_date': _iso(mine.updated_date),
        },
    }}), 200


@api.route('/public/service-requests/<token>/quotation', methods=['POST'])
def send_carrier_quotation(token):
    """El transportista manda (o corrige) su precio desde su link, sin login.

    La escritura y los avisos los hace el API principal; aca solo se valida el
    link y se reenvia. El carrier_company_id sale del token, nunca del cuerpo: si
    el navegador pudiera elegirlo, cualquiera con un link cotizaria por otra
    empresa. Las respuestas de validacion (400) y de estado (404, 409) se devuelven
    tal cual para que la pagina diga que paso.
    """
    service_request, carrier_company_id, error = _resolve_carrier_link(token)
    if error:
        return error

    data = request.get_json(silent=True) or {}
    internal_api = os.getenv('INTERNAL_API_URL', 'http://flask-api:8001')
    try:
        res = requests.post(
            f'{internal_api}/api/v1/service-requests/{service_request.id}/quotations',
            json={'carrier_company_id': carrier_company_id,
                  'amount': data.get('amount'), 'note': data.get('note')},
            headers=_internal_headers(),
            timeout=15,
        )
    except requests.RequestException:
        return jsonify({'message': 'could not reach the quotation service'}), 502
    if res.status_code not in (200, 201, 400, 404, 409):
        return jsonify({'message': 'failed to save the quotation'}), 502
    return jsonify(res.json()), res.status_code


@api.route('/service-requests/<int:service_request_id>/quotations/<int:quotation_id>/select', methods=['POST'])
@admin_required
def select_service_request_quotation(service_request_id, quotation_id):
    """El admin elige una cotizacion. La logica (exclusividad, congelar la comision
    y el total) vive en el API principal; aca solo se controla el rol y se reenvia
    con el id de quien eligio. 404 y 409 se devuelven tal cual."""
    internal_api = os.getenv('INTERNAL_API_URL', 'http://flask-api:8001')
    try:
        res = requests.post(
            f'{internal_api}/api/v1/service-requests/{service_request_id}/quotations/{quotation_id}/select',
            json={'admin_user_id': g.current_user.id},
            headers=_internal_headers(),
            timeout=15,
        )
    except requests.RequestException:
        return jsonify({'message': 'could not reach the quotation service'}), 502
    if res.status_code not in (200, 400, 404, 409):
        return jsonify({'message': 'failed to select the quotation'}), 502
    return jsonify(res.json()), res.status_code
