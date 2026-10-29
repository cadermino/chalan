import json
import os
import pathlib
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

import jwt
import requests
from flask import current_app, g, jsonify, request
from sqlalchemy import func

from . import api
from .decorators import admin_required, login_required
from .orders import _internal_headers
from ..address import district_of
from ..service_media import make_token as make_media_token
from ..service_reviews import review_of, review_path
from .. import db
from ..models import (ROLE_SUPERADMIN, LIMA_DEPARTMENT_CODE, CarrierCompany, CarrierCompanyDepartment,
                      CarrierCompanyServiceType, ServiceRequest,
                      ServiceRequestCarrierDecline, ServiceRequestItem,
                      ServiceRequestNotification, ServiceRequestPayment, ServiceRequestQuotation,
                      ServiceMaterial, ServiceType, _iso, _money)

# Los mismos estados que una orden, como texto. Los escribe el API principal
# (app/api/service_request/statuses.py); un borrador es un pending sin submitted_at.
STATUSES = ('pending', 'in_progress', 'completed', 'cancelled')


def _is_draft(service_request):
    return service_request.status == 'pending' and service_request.submitted_at is None
TOKEN_PURPOSE = 'service_request'
TOKEN_TTL = timedelta(days=10)
LIST_LIMIT = 200
# El armador embala con los materiales de embalaje: mismo catálogo. Espejo de
# `materials_from` en app/api/service_request/types.py, que es quien valida.
MATERIALS_FROM = {'furniture_assembly': 'packing'}
# Dónde vive cada formulario en services-web; la página de cotizaciones del
# cliente es <ruta>/cotizaciones/<public_id>. Espejo de `form_path` en ese mismo archivo.
FORM_PATHS = {'packing': '/embalaje/cotizar', 'furniture_assembly': '/armado/cotizar', 'painting': '/pintura/cotizar',
              'masonry': '/porcelanato/cotizar', 'microcement': '/microcemento/cotizar'}


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
    # El nombre que ve el cliente, si no es el de la empresa (contactos cargados a mano).
    company = quotation.carrier_company
    data['carrier_contact_name'] = company.contact_name if company is not None else None
    # Para reconocer, en los contactos de Google Maps, a quién ya se le cargó su precio.
    digits = ''.join(ch for ch in (company.phone or '') if ch.isdigit()) if company is not None else ''
    data['carrier_phone'] = digits[-9:] or None
    if quotation.status == 'selected' and quotation.total_amount is not None:
        data['total_amount'] = _money(quotation.total_amount)
    else:
        data['total_amount'] = _money(_total_with_fee(quotation.amount, current_rate))
        data['platform_fee_rate'] = float(current_rate)
    return data


def _customer_quotations_path(service_request):
    """La página donde el cliente ve y elige; None mientras sea borrador (da 404)."""
    form_path = FORM_PATHS.get(service_request.service_type.code if service_request.service_type else None)
    if form_path is None or _is_draft(service_request):
        return None
    return f'{form_path}/cotizaciones/{service_request.public_id}'


def _quotation_state(service_request, carrier_company_id):
    """Que puede hacer este transportista con la solicitud. `selected_pending`: el
    cliente eligio la suya pero Chalan todavia no encuentra el yapeo de la reserva;
    recien con `selected_mine` el trabajo esta en firme y ve el contacto del cliente."""
    if service_request.status == 'cancelled':
        return 'cancelled'
    selected = next((q for q in service_request.quotations if q.status == 'selected'), None)
    if selected is None:
        return 'open'
    if selected.carrier_company_id != carrier_company_id:
        return 'selected_other'
    pending = any(p.status == 'pending' and p.service_request_quotation_id == selected.id
                  for p in service_request.payments)
    return 'selected_pending' if pending else 'selected_mine'


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
    if service_request is None or _is_draft(service_request):
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
    if code in MATERIALS_FROM:
        service_type = ServiceType.query.filter_by(code=MATERIALS_FROM[code]).first() or service_type
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


def _forward_edit(method, service_request_id, suffix, json=None):
    """Editar un servicio enviado y sus fotos: las reglas (las del formulario, y
    que no haya cotización elegida) y S3 viven en el API principal; acá solo se
    controla el rol. Los 400, 404 y 409 se devuelven tal cual."""
    internal_api = os.getenv('INTERNAL_API_URL', 'http://flask-api:8001')
    try:
        res = requests.request(
            method,
            f'{internal_api}/api/v1/service-requests/{service_request_id}{suffix}',
            json=json, headers=_internal_headers(), timeout=30,
        )
    except requests.RequestException:
        return jsonify({'message': 'could not reach the service request service'}), 502
    if res.status_code == 204:
        return '', 204
    if res.status_code not in (200, 201, 400, 404, 409):
        return jsonify({'message': 'failed to update the service request'}), 502
    return jsonify(res.json()), res.status_code


@api.route('/service-requests/<int:service_request_id>', methods=['PUT'])
@admin_required
def edit_service_request(service_request_id):
    return _forward_edit('PUT', service_request_id, '/manual', request.get_json(silent=True) or {})


@api.route('/service-requests/<int:service_request_id>/media/presign', methods=['POST'])
@admin_required
def presign_service_request_media(service_request_id):
    return _forward_edit('POST', service_request_id, '/media/presign', request.get_json(silent=True) or {})


@api.route('/service-requests/<int:service_request_id>/media', methods=['POST'])
@admin_required
def register_service_request_media(service_request_id):
    return _forward_edit('POST', service_request_id, '/media', request.get_json(silent=True) or {})


@api.route('/service-requests/<int:service_request_id>/media/<int:media_id>', methods=['DELETE'])
@admin_required
def delete_service_request_media(service_request_id, media_id):
    return _forward_edit('DELETE', service_request_id, f'/media/{media_id}')


def _deposits(request_ids):
    """Cómo va la reserva que el cliente le yapea a Chalán, por solicitud, como la
    columna Adelanto de las órdenes. Sin entrada si no hay cotización elegida;
    'none' si se eligió sin reserva (sin YAPE_RESERVATION_REQUIRED, o la eligió un
    admin). Dos consultas para toda la lista, no dos por fila."""
    if not request_ids:
        return {}
    selected = dict(
        db.session.query(ServiceRequestQuotation.service_request_id, ServiceRequestQuotation.id)
        .filter(ServiceRequestQuotation.service_request_id.in_(request_ids),
                ServiceRequestQuotation.status == 'selected').all())
    deposits = {request_id: {'status': 'none', 'amount': None} for request_id in selected}
    live = (ServiceRequestPayment.query
            .filter(ServiceRequestPayment.service_request_id.in_(list(selected)),
                    ServiceRequestPayment.concept == 'reservation',
                    ServiceRequestPayment.status != 'cancelled')
            .order_by(ServiceRequestPayment.id).all()) if selected else []
    for payment in live:
        if selected.get(payment.service_request_id) == payment.service_request_quotation_id:
            deposits[payment.service_request_id] = {'status': payment.status, 'amount': _money(payment.amount)}
    return deposits


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
    notified = _counts(ServiceRequestNotification, ids)
    deposits = _deposits(ids)
    quotations = {}
    # El precio de la elegida: con una elegida, el "desde" de las demás ya no dice nada.
    chosen = dict(
        db.session.query(ServiceRequestQuotation.service_request_id, ServiceRequestQuotation.amount)
        .filter(ServiceRequestQuotation.service_request_id.in_(ids),
                ServiceRequestQuotation.status == 'selected').all()) if ids else {}
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
            'whatsapp': r.whatsapp,
            'customer_name': r.customer_name,
            'items_count': items.get(r.id, 0),
            'notified_count': notified.get(r.id, 0),
            'quotations_count': quotations.get(r.id, (0, None))[0],
            'min_amount': quotations.get(r.id, (0, None))[1],
            'selected_amount': _money(chosen[r.id]) if r.id in chosen else None,
            'deposit': deposits.get(r.id),
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
    declines = ServiceRequestCarrierDecline.query.filter_by(service_request_id=service_request.id) \
        .order_by(ServiceRequestCarrierDecline.updated_date.desc()).all()
    return jsonify({'service_request': {
        **service_request.to_dict_full(),
        'materials_summary': _materials_summary(service_request),
        'notifications': [n.to_dict() for n in service_request.notifications],
        'platform_fee_rate': float(current_rate),
        'quotations': [
            _quotation_for_admin(q, current_rate)
            for q in sorted(service_request.quotations, key=lambda q: (q.amount, q.id))
        ],
        'declines': [d.to_dict() for d in declines],
        'payments': [p.to_dict() for p in service_request.payments],
        'customer_quotations_path': _customer_quotations_path(service_request),
        # El pedido con sus fotos para mandar por WhatsApp a quien va a cotizar,
        # sin la dirección ni el public_id (los contactos de Google Maps no
        # tienen link de empresa). Un borrador no se comparte.
        'share_path': None if _is_draft(service_request) else f'/v/{make_media_token(service_request)}',
        # Completado: el link para que el cliente califique a quien lo hizo, y lo
        # que calificó si ya lo hizo.
        'review_path': review_path(service_request),
        'review': review_of(service_request),
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
    # Solo el estado: los datos se editan con PUT (edit_service_request), que
    # pasa por las reglas del API principal. Cancelar lo puede cualquier admin; poner otro
    # estado a mano, solo un superadmin, como editar el estado de una orden.
    # El API principal lo vuelve a calcular (sync_status) la próxima vez que
    # cambie la elección o un pago.
    status = data.get('status')
    if status not in STATUSES:
        return jsonify({'message': 'invalid status'}), 400
    if status != 'cancelled' and g.current_user.role != ROLE_SUPERADMIN:
        return jsonify({'message': 'only a superadmin can set that status'}), 403
    # Un borrador no se envió a nadie: sacarlo de pending lo haría pasar por enviado.
    if _is_draft(service_request) and status not in ('pending', 'cancelled'):
        return jsonify({'message': 'a draft can only be cancelled'}), 409
    service_request.status = status
    db.session.commit()
    return jsonify({'service_request': service_request.to_dict_full()}), 200


@api.route('/service-requests/bulk-cancel', methods=['POST'])
@admin_required
def bulk_cancel_service_requests():
    """Cancela varias solicitudes de una vez desde la lista, como las órdenes.

    Solo las que no tienen una cotización elegida: una elegida ya tiene
    transportista y quizá una reserva yapeada, y eso se resuelve de a una desde
    el detalle. Las que no califican vuelven en `skipped` con el motivo en vez
    de hacer fallar el lote entero. Mismo permiso que cancelar una (admin)."""
    raw_ids = (request.get_json(silent=True) or {}).get('service_request_ids')
    if not isinstance(raw_ids, list) or not raw_ids:
        return jsonify({'message': 'service_request_ids must be a non-empty list'}), 400
    if any(isinstance(i, bool) or not isinstance(i, int) for i in raw_ids):
        return jsonify({'message': 'service_request_ids must be integers'}), 400
    ids = list(dict.fromkeys(raw_ids))
    if len(ids) > LIST_LIMIT:
        return jsonify({'message': f'at most {LIST_LIMIT} requests at a time'}), 400

    found = {r.id: r for r in ServiceRequest.query.filter(ServiceRequest.id.in_(ids)).all()}
    cancelled, skipped = [], []
    for request_id in ids:
        service_request = found.get(request_id)
        if service_request is None:
            skipped.append({'id': request_id, 'reason': 'no existe'})
        elif service_request.status == 'cancelled':
            skipped.append({'id': request_id, 'reason': 'ya estaba cancelada'})
        elif any(q.status == 'selected' for q in service_request.quotations):
            skipped.append({'id': request_id, 'reason': 'tiene una cotización elegida'})
        else:
            service_request.status = 'cancelled'
            cancelled.append(request_id)
    db.session.commit()
    return jsonify({'cancelled': cancelled, 'skipped': skipped}), 200


# Lo que identifica la casa del cliente. El link llega a todas las empresas
# que ofrecen el servicio, así que antes de que el trabajo quede en firme con
# una solo ven el distrito, como el correo de "nueva solicitud"; la elegida
# recibe la dirección junto con el WhatsApp del cliente.
EXACT_ADDRESS_FIELDS = ('street', 'interior', 'map_url')


def _hide_exact_address(address):
    return {**address, 'neighborhood': district_of(address), **{field: None for field in EXACT_ADDRESS_FIELDS}}


def _district_only(data, keep_address):
    if keep_address:
        return {**data, 'address_hidden': False}
    hidden = {**_hide_exact_address(data), 'address_hidden': True}
    destination = (data.get('details') or {}).get('destination')
    if destination:
        hidden['details'] = {**data['details'], 'destination': _hide_exact_address(destination)}
    return hidden


@api.route('/public/service-requests/<token>', methods=['GET'])
def get_service_request_for_carrier(token):
    """La solicitud tal como la ve el transportista que recibio el link. Sin login."""
    service_request, carrier_company_id, error = _resolve_carrier_link(token)
    if error:
        return error
    carrier = db.session.get(CarrierCompany, carrier_company_id)
    mine = next((q for q in service_request.quotations if q.carrier_company_id == carrier_company_id), None)
    my_decline = ServiceRequestCarrierDecline.query.filter_by(
        service_request_id=service_request.id, carrier_company_id=carrier_company_id).first()

    # to_dict() no incluye el WhatsApp del cliente a proposito: solo lo ve el
    # transportista elegido y con el trabajo en firme (como una mudanza agendada).
    # Tampoco se expone ninguna cotizacion ajena: solo la suya y un estado.
    state = _quotation_state(service_request, carrier_company_id)
    return jsonify({'service_request': {
        **_district_only(service_request.to_dict(), keep_address=state == 'selected_mine'),
        'materials_summary': _materials_summary(service_request),
        'carrier_company_name': carrier.name if carrier else None,
        'quotation_state': state,
        'customer_contact': {'whatsapp': service_request.whatsapp, 'name': service_request.customer_name}
        if state == 'selected_mine' else None,
        'my_quotation': None if mine is None else {
            'amount': _money(mine.amount),
            'note': mine.note,
            'status': mine.status,
            'updated_date': _iso(mine.updated_date),
        },
        'my_decline': None if my_decline is None else {
            'reason': my_decline.reason,
            'note': my_decline.note,
            'updated_date': _iso(my_decline.updated_date),
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


@api.route('/public/service-requests/<token>/decline', methods=['POST', 'DELETE'])
def decline_carrier_service_request(token):
    """El transportista avisa desde su link que no puede hacer el trabajo (POST) o
    lo deshace (DELETE), sin login. Igual que send_carrier_quotation: se valida el
    link, la empresa sale del token y el API principal escribe."""
    service_request, carrier_company_id, error = _resolve_carrier_link(token)
    if error:
        return error

    data = request.get_json(silent=True) or {}
    payload = {'carrier_company_id': carrier_company_id}
    if request.method == 'POST':
        payload.update({'reason': data.get('reason'), 'note': data.get('note')})

    internal_api = os.getenv('INTERNAL_API_URL', 'http://flask-api:8001')
    try:
        res = requests.request(
            request.method,
            f'{internal_api}/api/v1/service-requests/{service_request.id}/decline',
            json=payload,
            headers=_internal_headers(),
            timeout=15,
        )
    except requests.RequestException:
        return jsonify({'message': 'could not reach the quotation service'}), 502
    if res.status_code not in (200, 400, 404, 409):
        return jsonify({'message': 'failed to save the decline'}), 502
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


@api.route('/service-requests/<int:service_request_id>/payments/<int:payment_id>', methods=['POST'])
@admin_required
def resolve_service_request_payment(service_request_id, payment_id):
    """El admin encontró el yapeo de la reserva (paid) o no (cancelled). La lógica
    y los avisos al transportista y al cliente viven en el API principal; acá
    solo se controla el rol y se reenvía con el id de quien lo resolvió."""
    status = (request.get_json(silent=True) or {}).get('status')
    if status not in ('paid', 'cancelled'):
        return jsonify({'message': 'status must be paid or cancelled'}), 400
    internal_api = os.getenv('INTERNAL_API_URL', 'http://flask-api:8001')
    try:
        res = requests.post(
            f'{internal_api}/api/v1/service-requests/{service_request_id}/payments/{payment_id}',
            json={'status': status, 'admin_user_id': g.current_user.id},
            headers=_internal_headers(),
            timeout=30,
        )
    except requests.RequestException:
        return jsonify({'message': 'could not reach the payment service'}), 502
    if res.status_code not in (200, 400, 404, 409):
        return jsonify({'message': 'failed to update the payment'}), 502
    return jsonify(res.json()), res.status_code


def _forward_payment(method, path, body=None):
    """Reenvía al API principal, dueño de los pagos y de los avisos. 400, 404 y
    409 se devuelven tal cual para que la pantalla diga qué pasó."""
    internal_api = os.getenv('INTERNAL_API_URL', 'http://flask-api:8001')
    try:
        res = requests.request(
            method, f'{internal_api}/api/v1{path}',
            json={**(body or {}), 'admin_user_id': g.current_user.id},
            headers=_internal_headers(),
            timeout=30,
        )
    except requests.RequestException:
        return jsonify({'message': 'could not reach the payment service'}), 502
    if res.status_code == 204:
        return '', 204
    if res.status_code not in (200, 201, 400, 404, 409):
        return jsonify({'message': 'failed to update the payment'}), 502
    return jsonify(res.json()), res.status_code


@api.route('/service-requests/<int:service_request_id>/reservation', methods=['POST'])
@admin_required
def register_service_request_reservation(service_request_id):
    """El admin registra una reserva que ya vio en Yape, para una elegida sin
    reserva (la eligió él, o se cerró por WhatsApp). El API principal la crea
    pagada y avisa al transportista y al cliente, salvo con `notify: false`."""
    data = request.get_json(silent=True) or {}
    body = {'operation_number': data.get('operation_number')}
    if 'notify' in data:
        body['notify'] = data['notify']
    return _forward_payment('POST', f'/service-requests/{service_request_id}/reservation', body)


@api.route('/service-requests/<int:service_request_id>/carrier-cash', methods=['POST', 'DELETE'])
@admin_required
def service_request_carrier_cash(service_request_id):
    """El cliente le pagó al transportista en el lugar (POST): la solicitud queda
    completada. DELETE lo deshace si se registró por error."""
    return _forward_payment(request.method, f'/service-requests/{service_request_id}/carrier-cash')


SERVICE_PROSPECTS = pathlib.Path(__file__).resolve().parent.parent / 'resources' / 'service_prospects.json'


def _company_by_phone(digits):
    """La empresa con ese WhatsApp (los últimos 9 dígitos), registrada o no."""
    for company in CarrierCompany.query.filter(CarrierCompany.phone.isnot(None)).all():
        if ''.join(ch for ch in company.phone if ch.isdigit())[-9:] == digits:
            return company
    return None


@api.route('/service-requests/<int:service_request_id>/contact-quotations', methods=['POST'])
@admin_required
def add_contact_quotation(service_request_id):
    """La cotización de alguien que no es empresa de la plataforma (un contacto de
    Google Maps que respondió por WhatsApp), cargada por el admin con su precio y
    su comentario para el cliente.

    Toda cotización tiene que ser de una empresa: de ahí salen el nombre que ve el
    cliente, el WhatsApp que se le muestra al confirmarse y el link de "¡Te
    eligieron!". Si el teléfono no es de ninguna, se crea inactiva (no recibe
    otros pedidos) con este servicio marcado; si ya existe, se usa esa, así que
    volver a cargarla corrige su precio. Lo demás es lo mismo que cuando una
    empresa cotiza desde su link.

    `contact_name` es la persona que contesta el WhatsApp: es lo que ve el cliente
    (con el nombre del negocio lo buscaría en Google). `name`, el del negocio, es
    opcional y queda para el admin. A una empresa registrada no se le cambia nada:
    el cliente la sigue viendo por su nombre.
    """
    service_request = db.session.get(ServiceRequest, service_request_id)
    if service_request is None:
        return jsonify({'message': 'service request not found'}), 404
    data = request.get_json(silent=True) or {}
    contact_name = (data.get('contact_name') or '').strip()[:60]
    name = (data.get('name') or '').strip() or contact_name
    digits = ''.join(ch for ch in str(data.get('phone') or '') if ch.isdigit())[-9:]
    if not contact_name or len(digits) != 9:
        return jsonify({'message': 'contact_name and a 9-digit phone are required'}), 400

    company = _company_by_phone(digits)
    if company is not None and not company.active:
        # Otra persona puede contestar la próxima vez: el cliente ve la última.
        company.contact_name = contact_name
        db.session.commit()
    if company is None:
        company = CarrierCompany(
            name=name[:45],
            contact_name=contact_name,
            phone=digits,
            # NOT NULL en la base (con '' por defecto, pero SQLAlchemy manda NULL).
            rfc='', email='', address='',
            active=0,
            description=f'Contacto de Google Maps: entró al cargar su cotización del servicio #{service_request.id}.',
        )
        company.service_types = [service_request.service_type] if service_request.service_type else []
        company.departments = [CarrierCompanyDepartment(department_code=LIMA_DEPARTMENT_CODE)]
        db.session.add(company)
        db.session.commit()

    internal_api = os.getenv('INTERNAL_API_URL', 'http://flask-api:8001')
    try:
        res = requests.post(
            f'{internal_api}/api/v1/service-requests/{service_request.id}/quotations',
            json={'carrier_company_id': company.id, 'amount': data.get('amount'), 'note': data.get('note')},
            headers=_internal_headers(),
            timeout=15,
        )
    except requests.RequestException:
        return jsonify({'message': 'could not reach the quotation service'}), 502
    if res.status_code not in (200, 201, 400, 404, 409):
        return jsonify({'message': 'failed to save the quotation'}), 502
    return jsonify({**res.json(), 'carrier_company_id': company.id}), res.status_code


@api.route('/service-prospects/<code>', methods=['GET'])
@admin_required
def service_prospects(code):
    """Negocios de Google Maps que hacen un servicio, para invitarlos a cotizar.

    Como los transportistas fuera de Lima: contactos en frío, no empresas de la
    plataforma. La lista la arma el equipo a mano en
    `resources/service_prospects.json`, por código de servicio; un servicio sin
    lista devuelve una vacía.
    """
    data = json.loads(SERVICE_PROSPECTS.read_text(encoding='utf-8'))
    prospects = data.get(code) if not code.startswith('_') else None
    return jsonify({'prospects': prospects if isinstance(prospects, list) else []}), 200

