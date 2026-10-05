import os
import uuid
from datetime import datetime

from flask import current_app, jsonify, request

from . import api
from .decorators import is_internal_request
from .service_request.notifications import notify_service_request
from .service_request.types import SERVICE_TYPES
from .service_request.validation import (
    MAX_MEDIA, InvalidRequest, validate_address, validate_items,
    validate_media_upload, validate_preferred_date, MEDIA_MAX_BYTES,
)
from .whatsapp import normalize_phone
from .. import db
from ..models import ServiceMaterial, ServiceRequest, ServiceRequestItem, ServiceRequestMedia, ServiceType
from ..storage import get_storage


@api.errorhandler(InvalidRequest)
def _invalid_request(error):
    return jsonify({'message': str(error)}), 400


def _message(text, status):
    return jsonify({'message': text}), status


def _get_service_type(code):
    """Active service type of the catalog that this code knows how to validate."""
    if code not in SERVICE_TYPES:
        return None
    return ServiceType.query.filter_by(code=code, active=1).first()


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
        'address': _address_dict(service_request),
        'preferred_date': service_request.preferred_date.isoformat() if service_request.preferred_date else None,
        'whatsapp': service_request.whatsapp,
        'details': service_request.details or {},
        'items': [
            {
                'description': item.description,
                'quantity': item.quantity,
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
        ServiceMaterial.query.filter_by(service_type_id=service_type.id, active=1)
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
        status='draft',
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


@api.route('/service-requests/<public_id>', methods=['PATCH'])
def update_service_request(public_id):
    service_request = _find_request(public_id)
    if service_request is None:
        return _message('service request not found', 404)
    if service_request.status != 'draft':
        return _message('service request is no longer a draft', 409)

    data = request.get_json(silent=True) or {}
    # Validate everything before writing anything: a PATCH is all or nothing.
    address = validate_address(data['address']) if 'address' in data else None
    preferred_date = validate_preferred_date(data['preferred_date']) if 'preferred_date' in data else None
    items = validate_items(data['items'], service_request.service_type_id) if 'items' in data else None
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
    if service_request.status != 'draft':
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
    if service_request.status != 'draft':
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
    if service_request.status != 'draft':
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
    if service_request.status == 'submitted':
        return jsonify(_serialize(service_request)), 200
    if service_request.status != 'draft':
        return _message('service request was cancelled', 409)

    data = request.get_json(silent=True) or {}

    # The saved address was validated when it was written, but a field can be
    # missing if the draft never completed the step.
    address = validate_address(_address_dict(service_request))
    if not service_request.items:
        raise InvalidRequest('at least one item is required')
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
    service_request.status = 'submitted'
    service_request.submitted_at = datetime.utcnow()
    db.session.commit()

    try:
        notify_service_request(service_request)
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Service request notification error: {e}')
    return jsonify(_serialize(service_request)), 200


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
    if not address['neighborhood']:
        raise InvalidRequest('address.neighborhood is required')
    if not address['map_url'].startswith(('http://', 'https://')):
        raise InvalidRequest('address.map_url must be a link')
    items = validate_items(data.get('items'), service_type.id)
    if not items:
        raise InvalidRequest('at least one item is required')
    preferred_date = validate_preferred_date(data.get('preferred_date'), allow_today=True)
    whatsapp = normalize_phone(data.get('whatsapp'))
    if whatsapp is None:
        raise InvalidRequest('a valid whatsapp number is required')

    country_id = os.getenv('COUNTRY_ID')
    service_request = ServiceRequest(
        public_id=uuid.uuid4().hex,
        service_type_id=service_type.id,
        country_id=int(country_id) if country_id else None,
        status='submitted',
        whatsapp=whatsapp,
        preferred_date=preferred_date,
        submitted_at=datetime.utcnow(),
        details={},
    )
    _set_address(service_request, address)
    _set_items(service_request, items)
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
    if service_request.status != 'submitted':
        return _message('only submitted requests can be sent to carriers', 409)

    notified = notify_service_request(service_request, notify_admin=False)
    return jsonify({'notified_carrier_ids': notified}), 200
