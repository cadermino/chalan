import os
import uuid
from datetime import datetime

from flask import current_app, jsonify, request

from . import api
from .decorators import is_internal_request
from .carrier_declines import (decline_service_request, decline_to_dict, parse_decline,
                               undo_service_request_decline)
from .operation_numbers import clean_operation_number, is_valid_operation_number, operation_number_in_use
from .order.order import yape_reservation_required
from .service_request.notifications import (
    contact_details, notify_customer_choice, notify_job_confirmed, notify_new_quotation, notify_service_request,
)
from .service_request.quotations import (
    RESERVATION, QuotationError, confirmed_quotation, live_reservation, parse_amount, parse_note,
    platform_fee_rate, record_carrier_cash, record_reservation, register_reservation, resolve_reservation,
    save_quotation, select_quotation, split_total, undo_carrier_cash,
)
from .service_request.statuses import CANCELLED, PENDING, is_draft
from .service_request.types import SERVICE_TYPES
from .service_request.validation import (
    MAX_MEDIA, InvalidRequest, validate_address, validate_items,
    validate_media_upload, validate_preferred_date, MEDIA_MAX_BYTES,
)
from .whatsapp import normalize_phone
from .. import db
from ..models import (ServiceMaterial, ServiceRequest, ServiceRequestItem, ServiceRequestMedia,
                      ServiceRequestQuotation, ServiceType)
from ..storage import get_storage


@api.errorhandler(InvalidRequest)
def _invalid_request(error):
    return jsonify({'message': str(error)}), 400


@api.errorhandler(QuotationError)
def _quotation_error(error):
    return jsonify({'message': str(error)}), error.status


def _message(text, status):
    return jsonify({'message': text}), status


def _get_service_type(code):
    """Active, requestable service type that this code knows how to validate.

    The catalog also lists what a company does (moving among them), and not all
    of that is asked for through a request form: `requestable` says which is.
    """
    if code not in SERVICE_TYPES:
        return None
    return ServiceType.query.filter_by(code=code, active=1, requestable=1).first()


def _materials_type(service_type):
    """The service whose materials catalog this one uses: its own, or the one
    named by `materials_from` (assembly packs with packing's materials)."""
    code = SERVICE_TYPES[service_type.code].get('materials_from')
    if code is None:
        return service_type
    return ServiceType.query.filter_by(code=code).first() or service_type


def _validate_items(items, service_type):
    return validate_items(items, _materials_type(service_type).id,
                          SERVICE_TYPES[service_type.code].get('validate_item'))


def _check_submit(service_request, service_type):
    check = SERVICE_TYPES[service_type.code].get('check_submit')
    if check is not None:
        check(service_request)


def _find_request(public_id, for_update=False):
    query = ServiceRequest.query.filter_by(public_id=public_id)
    if for_update:
        query = query.with_for_update()
    return query.first()


def _address_dict(service_request):
    return {
        'street': service_request.street,
        'interior': service_request.interior,
        'neighborhood': service_request.neighborhood,
        'city': service_request.city,
        'state': service_request.state,
        'country': service_request.country,
        'map_url': service_request.map_url,
    }


def _serialize(service_request):
    """What the form needs to resume a draft. The public_id is the credential,
    so the whatsapp the customer typed can safely come back to them."""
    return {
        'public_id': service_request.public_id,
        'service_type': service_request.service_type.code,
        'status': service_request.status,
        'submitted': service_request.submitted_at is not None,
        'address': _address_dict(service_request),
        'preferred_date': service_request.preferred_date.isoformat() if service_request.preferred_date else None,
        'whatsapp': service_request.whatsapp,
        'details': service_request.details or {},
        'items': [
            {
                'description': item.description,
                'quantity': item.quantity,
                'work': item.work,
                'pack': item.pack,
                'materials': [m.code for m in item.materials],
            }
            for item in service_request.items
        ],
        'media': [_serialize_media(m) for m in service_request.media],
    }


def _serialize_media(media):
    return {'id': media.id, 'url': media.url, 'media_type': media.media_type}


def _set_address(service_request, address):
    for field, value in address.items():
        setattr(service_request, field, value)


def _set_items(service_request, items):
    service_request.items = [
        ServiceRequestItem(
            description=item['description'],
            quantity=item['quantity'],
            position=position,
            work=item.get('work'),
            pack=item.get('pack'),
            materials=item['materials'],
        )
        for position, item in enumerate(items)
    ]


@api.route('/service-types/<code>/materials', methods=['GET'])
def list_service_materials(code):
    service_type = _get_service_type(code)
    if service_type is None:
        return _message('service type not found', 404)
    materials = (
        ServiceMaterial.query.filter_by(service_type_id=_materials_type(service_type).id, active=1)
        .order_by(ServiceMaterial.position, ServiceMaterial.id).all()
    )
    return jsonify([
        {'code': m.code, 'name': m.name, 'description': m.description} for m in materials
    ]), 200


@api.route('/service-requests', methods=['POST'])
def create_service_request():
    data = request.get_json(silent=True) or {}

    # Honeypot: the form never fills `website`, bots fill every field. They get
    # a believable answer and nothing is stored, so there is no signal to adapt to.
    if data.get('website'):
        return jsonify({'public_id': uuid.uuid4().hex}), 201

    service_type = _get_service_type(data.get('service_type'))
    if service_type is None:
        raise InvalidRequest('unknown service_type')
    address = validate_address(data.get('address'))

    country_id = os.getenv('COUNTRY_ID')
    service_request = ServiceRequest(
        public_id=uuid.uuid4().hex,
        service_type_id=service_type.id,
        country_id=int(country_id) if country_id else None,
        status=PENDING,
        details={},
    )
    _set_address(service_request, address)
    db.session.add(service_request)
    db.session.commit()
    return jsonify({'public_id': service_request.public_id}), 201


@api.route('/service-requests/<public_id>', methods=['GET'])
def get_service_request(public_id):
    service_request = _find_request(public_id)
    if service_request is None:
        return _message('service request not found', 404)
    return jsonify(_serialize(service_request)), 200


def _customer_quotation(quotation, rate):
    """Lo que ve el cliente: el total (el congelado si ya la eligieron) y cómo se
    reparte entre la reserva y lo que paga en el lugar. Nunca el teléfono."""
    total, reservation, on_site = split_total(quotation, rate)
    return {
        'id': quotation.id,
        'carrier_name': quotation.carrier_company.name if quotation.carrier_company else None,
        'total_amount': float(total),
        'reservation_amount': float(reservation),
        'on_site_amount': float(on_site),
        'note': quotation.note,
        'selected': quotation.status == 'selected',
    }


def _customer_reservation(service_request):
    """La reserva que importa en la página: la de la elegida, o la última
    cancelada si ya no hay elegida (no se encontró el yapeo y puede reintentar)."""
    reservations = [p for p in service_request.payments if p.concept == RESERVATION]
    if not reservations:
        return None
    selected = next((q for q in service_request.quotations if q.status == 'selected'), None)
    latest = reservations[-1]
    if selected is not None:
        latest = live_reservation(service_request, selected.id)
    elif latest.status != 'cancelled':
        latest = None
    if latest is None:
        return None
    return {'status': latest.status, 'amount': float(latest.amount), 'reference': latest.reference}


def _carrier_contact(service_request):
    """El contacto del transportista elegido, solo con el trabajo en firme: antes
    de eso el cliente y el transportista no se ven los datos."""
    quotation = confirmed_quotation(service_request)
    if quotation is None or quotation.carrier_company is None:
        return None
    contact = contact_details(service_request, quotation.carrier_company)
    return {'name': quotation.carrier_company.name, 'phone': contact['carrier_phone'],
            'whatsapp_url': contact['carrier_whatsapp_url']}


def _requires_reservation(quotation):
    _, reservation, _ = split_total(quotation, platform_fee_rate())
    return yape_reservation_required() and reservation > 0


@api.route('/service-requests/<public_id>/quotations', methods=['GET'])
def get_customer_quotations(public_id):
    """La página de cotizaciones del cliente. Un borrador da 404: el link recién
    existe cuando la solicitud se envió."""
    service_request = _find_request(public_id)
    if service_request is None or is_draft(service_request):
        return _message('service request not found', 404)
    rate = platform_fee_rate()
    quotations = sorted(service_request.quotations, key=lambda q: (q.amount, q.id))
    return jsonify({
        'service_type': {'code': service_request.service_type.code, 'name': service_request.service_type.name},
        'status': service_request.status,
        'neighborhood': service_request.neighborhood,
        'preferred_date': service_request.preferred_date.isoformat() if service_request.preferred_date else None,
        'items': [
            {'description': item.description, 'quantity': item.quantity, 'work': item.work, 'pack': item.pack}
            for item in service_request.items
        ],
        # Lo decide el servidor (YAPE_RESERVATION_REQUIRED), no una variable del
        # front: así la página y el chequeo de /choose no pueden desalinearse.
        'reservation_required': yape_reservation_required(),
        'reservation': _customer_reservation(service_request),
        'carrier_contact': _carrier_contact(service_request),
        'quotations': [_customer_quotation(q, rate) for q in quotations],
    }), 200


@api.route('/service-requests/<public_id>/choose', methods=['POST'])
def choose_service_request_quotation(public_id):
    """El cliente elige una cotización desde su página (el modal de confirmar).

    Con YAPE_RESERVATION_REQUIRED tiene que informar el número de operación del
    yapeo de la reserva: la cotización queda elegida, pero el transportista se
    entera recién cuando un admin encuentra el yapeo. Sin la variable, elegir la
    deja en firme y se avisa al transportista. Elegir la misma otra vez no hace
    nada (o corrige el número si la reserva sigue por verificar); elegir otra
    cuando ya hay una elegida es 409."""
    data = request.get_json(silent=True) or {}
    quotation_id = data.get('quotation_id')
    if isinstance(quotation_id, bool) or not isinstance(quotation_id, int):
        raise InvalidRequest('quotation_id is required')
    service_request = _find_request(public_id)
    if service_request is None or is_draft(service_request):
        return _message('service request not found', 404)
    target = next((q for q in service_request.quotations if q.id == quotation_id), None)
    if target is None:
        return _message('quotation not found', 404)

    requires = _requires_reservation(target)
    number = clean_operation_number(data.get('operation_number'))
    if requires:
        if not is_valid_operation_number(number):
            return _message('invalid_operation_number', 400)
        if operation_number_in_use(number, service_request_id=service_request.id):
            return _message('operation_number_already_used', 409)

    was_selected = target.status == 'selected'
    quotation = select_quotation(service_request.id, quotation_id, None, replace=False)
    try:
        if requires:
            reservation, created = record_reservation(service_request, quotation, number)
            if created:
                notify_customer_choice(service_request, quotation, reservation)
        elif not was_selected:
            notify_customer_choice(service_request, quotation)
            notify_job_confirmed(service_request, quotation, tell_customer=False)
    except Exception as e:
        # record_reservation ya hizo commit antes de avisar; lo que falla acá es un aviso.
        current_app.logger.error(f'Choice notification error: {e}')
    body = _customer_quotation(quotation, quotation.platform_fee_rate)
    body['reservation'] = _customer_reservation(service_request)
    body['carrier_contact'] = _carrier_contact(service_request)
    return jsonify(body), 200


@api.route('/service-requests/<int:service_request_id>/payments/<int:payment_id>', methods=['POST'])
def resolve_service_request_payment(service_request_id, payment_id):
    """El admin encontró el yapeo de la reserva (paid) o no (cancelled). Interno:
    el backoffice-api revisa el rol. Confirmarla es lo que pone el trabajo en
    firme y le avisa al transportista y al cliente."""
    if not is_internal_request():
        return _message('forbidden', 403)
    data = request.get_json(silent=True) or {}
    status = data.get('status')
    if status not in ('paid', 'cancelled'):
        raise InvalidRequest('status must be paid or cancelled')
    admin_user_id = data.get('admin_user_id')
    if admin_user_id is not None and (isinstance(admin_user_id, bool) or not isinstance(admin_user_id, int)):
        raise InvalidRequest('admin_user_id must be an id')

    payment = resolve_reservation(service_request_id, payment_id, status, admin_user_id)
    if status == 'paid':
        quotation = db.session.get(ServiceRequestQuotation, payment.service_request_quotation_id)
        if quotation is not None and quotation.status == 'selected':
            try:
                notify_job_confirmed(payment.service_request, quotation, tell_customer=True)
            except Exception as e:
                current_app.logger.error(f'Confirmation notification error: {e}')
    return jsonify({'id': payment.id, 'status': payment.status}), 200


def _admin_user_id(data):
    admin_user_id = data.get('admin_user_id')
    if admin_user_id is not None and (isinstance(admin_user_id, bool) or not isinstance(admin_user_id, int)):
        raise InvalidRequest('admin_user_id must be an id')
    return admin_user_id


@api.route('/service-requests/<int:service_request_id>/reservation', methods=['POST'])
def register_service_request_reservation(service_request_id):
    """El admin registra una reserva que ya vio en Yape, para una elegida sin
    reserva (la eligió él, o se cerró por WhatsApp). Interno. Pone el trabajo en
    firme y avisa al transportista y al cliente, igual que confirmar un yapeo.
    El número de operación es opcional; si viene, no puede estar usado."""
    if not is_internal_request():
        return _message('forbidden', 403)
    data = request.get_json(silent=True) or {}
    admin_user_id = _admin_user_id(data)
    number = clean_operation_number(data.get('operation_number'))
    if number:
        if not is_valid_operation_number(number):
            return _message('invalid_operation_number', 400)
        if operation_number_in_use(number, service_request_id=service_request_id):
            return _message('operation_number_already_used', 409)

    payment, quotation = register_reservation(service_request_id, admin_user_id, number)
    try:
        notify_job_confirmed(payment.service_request, quotation, tell_customer=True)
    except Exception as e:
        current_app.logger.error(f'Confirmation notification error: {e}')
    return jsonify({'id': payment.id, 'status': payment.status}), 201


@api.route('/service-requests/<int:service_request_id>/carrier-cash', methods=['POST', 'DELETE'])
def service_request_carrier_cash(service_request_id):
    """El admin registra que el cliente le pagó al transportista en el lugar
    (POST), lo que deja la solicitud completada, o lo deshace (DELETE). Interno.
    No avisa a nadie: lo cuentan ellos."""
    if not is_internal_request():
        return _message('forbidden', 403)
    if request.method == 'DELETE':
        undo_carrier_cash(service_request_id)
        return '', 204
    payment = record_carrier_cash(service_request_id, _admin_user_id(request.get_json(silent=True) or {}))
    return jsonify({'id': payment.id, 'status': payment.status, 'amount': float(payment.amount)}), 200


@api.route('/service-requests/<public_id>', methods=['PATCH'])
def update_service_request(public_id):
    service_request = _find_request(public_id)
    if service_request is None:
        return _message('service request not found', 404)
    if not is_draft(service_request):
        return _message('service request is no longer a draft', 409)

    data = request.get_json(silent=True) or {}
    # Validate everything before writing anything: a PATCH is all or nothing.
    address = validate_address(data['address']) if 'address' in data else None
    preferred_date = validate_preferred_date(data['preferred_date']) if 'preferred_date' in data else None
    items = _validate_items(data['items'], service_request.service_type) if 'items' in data else None
    details = None
    if 'details' in data:
        details = SERVICE_TYPES[service_request.service_type.code]['validate_details'](data['details'])

    if address is not None:
        _set_address(service_request, address)
    if preferred_date is not None:
        service_request.preferred_date = preferred_date
    if items is not None:
        _set_items(service_request, items)
    if details is not None:
        service_request.details = details
    db.session.commit()
    return jsonify(_serialize(service_request)), 200


@api.route('/service-requests/<public_id>/media/presign', methods=['POST'])
def presign_service_request_media(public_id):
    service_request = _find_request(public_id)
    if service_request is None:
        return _message('service request not found', 404)
    if not is_draft(service_request):
        return _message('service request is no longer a draft', 409)

    data = request.get_json(silent=True) or {}
    content_type = data.get('content_type')
    media_type, extension = validate_media_upload(content_type, data.get('size_bytes'))
    if len(service_request.media) >= MAX_MEDIA:
        raise InvalidRequest(f'at most {MAX_MEDIA} files are allowed')

    storage_key = f'service-requests/{public_id}/{uuid.uuid4().hex}.{extension}'
    upload = get_storage().presigned_post(
        storage_key, content_type, MEDIA_MAX_BYTES[media_type])
    return jsonify({'upload': upload, 'storage_key': storage_key}), 200


@api.route('/service-requests/<public_id>/media', methods=['POST'])
def register_service_request_media(public_id):
    service_request = _find_request(public_id)
    if service_request is None:
        return _message('service request not found', 404)
    if not is_draft(service_request):
        return _message('service request is no longer a draft', 409)

    data = request.get_json(silent=True) or {}
    storage_key = data.get('storage_key')
    prefix = f'service-requests/{public_id}/'
    # The key must be one this request was given: another request's file, or a
    # path that climbs out of the prefix, is not registrable here.
    if (not isinstance(storage_key, str) or not storage_key.startswith(prefix)
            or '/' in storage_key[len(prefix):] or '..' in storage_key):
        raise InvalidRequest('invalid storage_key')

    existing = ServiceRequestMedia.query.filter_by(
        service_request_id=service_request.id, storage_key=storage_key).first()
    if existing is not None:
        return jsonify(_serialize_media(existing)), 200

    storage = get_storage()
    stored = storage.head(storage_key)
    if stored is None:
        raise InvalidRequest('file was not uploaded')

    # The presigned POST already pins type and size; this re-checks what is
    # really in the bucket, because the registration is what the rest trusts.
    problem = None
    try:
        media_type, _ = validate_media_upload(stored['content_type'], stored['size'])
    except InvalidRequest as e:
        problem = str(e)
    if problem is None and len(service_request.media) >= MAX_MEDIA:
        problem = f'at most {MAX_MEDIA} files are allowed'
    if problem is not None:
        storage.delete(storage_key)
        raise InvalidRequest(problem)

    media = ServiceRequestMedia(
        service_request_id=service_request.id,
        url=storage.public_url(storage_key),
        storage_key=storage_key,
        media_type=media_type,
        content_type=stored['content_type'],
        size_bytes=stored['size'],
    )
    db.session.add(media)
    db.session.commit()
    return jsonify(_serialize_media(media)), 201


@api.route('/service-requests/<public_id>/media/<int:media_id>', methods=['DELETE'])
def delete_service_request_media(public_id, media_id):
    service_request = _find_request(public_id)
    if service_request is None:
        return _message('service request not found', 404)
    if not is_draft(service_request):
        return _message('service request is no longer a draft', 409)

    media = ServiceRequestMedia.query.filter_by(
        id=media_id, service_request_id=service_request.id).first()
    if media is None:
        return _message('media not found', 404)

    try:
        get_storage().delete(media.storage_key)
    except Exception as e:
        current_app.logger.error(f'Service request media delete error: {e}')
        return _message('Error deleting file', 500)
    db.session.delete(media)
    db.session.commit()
    return '', 204


@api.route('/service-requests/<public_id>/submit', methods=['POST'])
def submit_service_request(public_id):
    # Locked so that two submits at once (a double click) cannot both see a
    # draft and notify everybody twice.
    service_request = _find_request(public_id, for_update=True)
    if service_request is None:
        return _message('service request not found', 404)
    if service_request.status == CANCELLED:
        return _message('service request was cancelled', 409)
    if not is_draft(service_request):
        return jsonify(_serialize(service_request)), 200

    data = request.get_json(silent=True) or {}

    # The saved address was validated when it was written, but a field can be
    # missing if the draft never completed the step.
    address = validate_address(_address_dict(service_request))
    if not service_request.items:
        raise InvalidRequest('at least one item is required')
    _check_submit(service_request, service_request.service_type)
    # Revalidated even if saved: a draft kept for days can hold a date that has
    # since passed.
    preferred_date = validate_preferred_date(
        data['preferred_date'] if 'preferred_date' in data
        else (service_request.preferred_date.isoformat() if service_request.preferred_date else None))
    whatsapp = normalize_phone(data.get('whatsapp'))
    if whatsapp is None:
        raise InvalidRequest('a valid whatsapp number is required')

    _set_address(service_request, address)
    service_request.preferred_date = preferred_date
    service_request.whatsapp = whatsapp
    service_request.submitted_at = datetime.utcnow()
    db.session.commit()

    try:
        notify_service_request(service_request)
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Service request notification error: {e}')
    return jsonify(_serialize(service_request)), 200


def _check_manual_address(address, name):
    """Typed by an admin, not picked from Google Places: the district is written
    by hand and the map link pasted, so both are checked here."""
    if not address['neighborhood']:
        raise InvalidRequest(f'{name}.neighborhood is required')
    if not address['map_url'].startswith(('http://', 'https://')):
        raise InvalidRequest(f'{name}.map_url must be a link')


@api.route('/service-requests/manual', methods=['POST'])
def create_manual_service_request():
    """Una solicitud que un admin anota a mano: el cliente la describió por
    WhatsApp o llamada en vez de usar el formulario. Interno: el backoffice-api la
    llama después de revisar el rol.

    Nace ya enviada, con las mismas reglas que el formulario (dirección con link de
    mapa, items, materiales del catálogo, WhatsApp válido). Cambia lo que tiene
    sentido para quien tipea: puede pedirla para hoy, y el distrito se escribe a
    mano porque no sale de Google Places.
    """
    if not is_internal_request():
        return _message('forbidden', 403)
    data = request.get_json(silent=True) or {}

    service_type = _get_service_type(data.get('service_type'))
    if service_type is None:
        raise InvalidRequest('unknown service_type')
    address = validate_address(data.get('address'))
    _check_manual_address(address, 'address')
    items = _validate_items(data.get('items'), service_type)
    if not items:
        raise InvalidRequest('at least one item is required')
    details = SERVICE_TYPES[service_type.code]['validate_details'](data.get('details'))
    if details.get('destination'):
        _check_manual_address(details['destination'], 'details.destination')
    preferred_date = validate_preferred_date(data.get('preferred_date'), allow_today=True)
    whatsapp = normalize_phone(data.get('whatsapp'))
    if whatsapp is None:
        raise InvalidRequest('a valid whatsapp number is required')

    country_id = os.getenv('COUNTRY_ID')
    service_request = ServiceRequest(
        public_id=uuid.uuid4().hex,
        service_type_id=service_type.id,
        country_id=int(country_id) if country_id else None,
        status=PENDING,
        whatsapp=whatsapp,
        preferred_date=preferred_date,
        submitted_at=datetime.utcnow(),
        details=details,
    )
    _set_address(service_request, address)
    _set_items(service_request, items)
    _check_submit(service_request, service_type)
    db.session.add(service_request)
    db.session.commit()

    # El admin que la crea ya la conoce: solo se avisa a los transportistas, y
    # solo si no pidió revisarla antes (se reenvía luego desde el detalle).
    notified = []
    if data.get('notify_carriers', True):
        try:
            notified = notify_service_request(service_request, notify_admin=False)
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f'Service request notification error: {e}')
    return jsonify({'id': service_request.id, 'public_id': service_request.public_id,
                    'notified_carrier_ids': notified}), 201


@api.route('/service-requests/<int:service_request_id>/notify-carriers', methods=['POST'])
def notify_service_request_carriers(service_request_id):
    """Resend to the carriers that were not told yet. Internal: the backoffice-api
    calls it after checking the admin's role."""
    if not is_internal_request():
        return _message('forbidden', 403)
    service_request = db.session.get(ServiceRequest, service_request_id)
    if service_request is None:
        return _message('service request not found', 404)
    if is_draft(service_request) or service_request.status == CANCELLED:
        return _message('only submitted requests can be sent to carriers', 409)

    notified = notify_service_request(service_request, notify_admin=False)
    return jsonify({'notified_carrier_ids': notified}), 200


@api.route('/service-requests/<int:service_request_id>/quotations', methods=['POST'])
def create_service_request_quotation(service_request_id):
    """Guarda el precio que manda un transportista. Interno: el backoffice-api lo
    llama con el carrier_company_id sacado del token del link, nunca del cuerpo
    que mando el navegador."""
    if not is_internal_request():
        return _message('forbidden', 403)
    data = request.get_json(silent=True) or {}

    carrier_company_id = data.get('carrier_company_id')
    if isinstance(carrier_company_id, bool) or not isinstance(carrier_company_id, int):
        raise InvalidRequest('carrier_company_id is required')
    amount = parse_amount(data.get('amount'))
    note = parse_note(data.get('note'))

    quotation, created = save_quotation(service_request_id, carrier_company_id, amount, note)
    # Guardada y confirmada: lo que falle al avisar no la deshace.
    try:
        notify_new_quotation(quotation.service_request, quotation, created)
    except Exception as e:
        current_app.logger.error(f'Quotation notification error: {e}')
    return jsonify({
        'id': quotation.id,
        'amount': float(quotation.amount),
        'note': quotation.note,
        'status': quotation.status,
        'created': created,
    }), 201 if created else 200


@api.route('/service-requests/<int:service_request_id>/quotations/<int:quotation_id>/select', methods=['POST'])
def select_service_request_quotation(service_request_id, quotation_id):
    """El admin elige una cotizacion. Interno: el backoffice-api revisa el rol."""
    if not is_internal_request():
        return _message('forbidden', 403)
    data = request.get_json(silent=True) or {}
    admin_user_id = data.get('admin_user_id')
    if admin_user_id is not None and (isinstance(admin_user_id, bool) or not isinstance(admin_user_id, int)):
        raise InvalidRequest('admin_user_id must be an id')

    quotation = select_quotation(service_request_id, quotation_id, admin_user_id)
    return jsonify({
        'id': quotation.id,
        'status': quotation.status,
        'amount': float(quotation.amount),
        'platform_fee_rate': float(quotation.platform_fee_rate),
        'total_amount': float(quotation.total_amount),
    }), 200


@api.route('/service-requests/<int:service_request_id>/decline', methods=['POST', 'DELETE'])
def decline_service_request_route(service_request_id):
    """El transportista avisa que no puede hacer el trabajo (POST) o se arrepiente
    (DELETE). Interno: el backoffice-api lo llama con el carrier_company_id sacado
    del token del link, nunca del cuerpo que mando el navegador."""
    if not is_internal_request():
        return _message('forbidden', 403)
    data = request.get_json(silent=True) or {}
    carrier_company_id = data.get('carrier_company_id')
    if isinstance(carrier_company_id, bool) or not isinstance(carrier_company_id, int):
        raise InvalidRequest('carrier_company_id is required')

    if request.method == 'DELETE':
        undo_service_request_decline(service_request_id, carrier_company_id)
        return jsonify({'decline': None}), 200

    reason, note = parse_decline(data)
    decline, withdrew_quotation = decline_service_request(
        service_request_id, carrier_company_id, reason, note)
    return jsonify({
        'decline': decline_to_dict(decline),
        'withdrew_quotation': withdrew_quotation,
    }), 200
