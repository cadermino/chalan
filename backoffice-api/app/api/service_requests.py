import os
from datetime import datetime, timedelta, timezone

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
                      ServiceType, _iso)

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


@api.route('/service-types', methods=['GET'])
@login_required
def list_service_types():
    types = ServiceType.query.filter_by(active=1).order_by(ServiceType.id).all()
    return jsonify({'service_types': [t.to_dict() for t in types]}), 200


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
    return jsonify({'service_request': {
        **service_request.to_dict_full(),
        'materials_summary': _materials_summary(service_request),
        'notifications': [n.to_dict() for n in service_request.notifications],
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
    """La solicitud tal como la ve el transportista que recibió el link. Sin login.

    Un token malo, de otro propósito o de una solicitud que no existe es 404, y
    uno vencido es 410. Nunca 401: el interceptor de axios del backoffice manda
    a /login ante un 401, y esta página la abre gente sin cuenta.
    """
    try:
        payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return jsonify({'message': 'link expired'}), 410
    except jwt.InvalidTokenError:
        return jsonify({'message': 'invalid link'}), 404
    if payload.get('purpose') != TOKEN_PURPOSE:
        return jsonify({'message': 'invalid link'}), 404

    service_request = db.session.get(ServiceRequest, payload.get('service_request_id'))
    carrier = db.session.get(CarrierCompany, payload.get('carrier_company_id'))
    # Un borrador no se avisó a nadie: si el link llega a uno, no existe todavía.
    if service_request is None or service_request.status == 'draft':
        return jsonify({'message': 'invalid link'}), 404

    # to_dict() no incluye el WhatsApp del cliente a propósito: el transportista
    # responde a Chalán, no al cliente.
    return jsonify({'service_request': {
        **service_request.to_dict(),
        'materials_summary': _materials_summary(service_request),
        'carrier_company_name': carrier.name if carrier else None,
    }}), 200
