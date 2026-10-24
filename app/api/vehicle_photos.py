"""La foto de un vehículo, que el cliente ve en la página del transportista.

Una por vehículo, en `vehicles.picture` (antes era una URL escrita a mano). Los
clientes juzgan por lo que ven: con la foto genérica de un camión enorme, uno
creyó que le mandaban eso. La sube un admin o el propio transportista desde el
backoffice, directo del navegador a S3 (presigned POST), bajo
`vehicles/<vehicle_id>/photo-<uuid>.<ext>`, que la política del bucket hace
pública como `orders/*`.

Solo con token interno: el backoffice-api ya revisó que quien sube puede tocar
esa empresa.
"""
import uuid

from flask import current_app, jsonify, request

from . import api
from .decorators import is_internal_request
from .service_request.validation import InvalidRequest
from .. import db
from ..models import Vehicle
from ..storage import get_storage

MAX_BYTES = 10 * 1024 * 1024
CONTENT_TYPES = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'}


def _forbidden():
    return jsonify({'message': 'forbidden'}), 403


def _vehicle(company_id, vehicle_id):
    vehicle = db.session.get(Vehicle, vehicle_id)
    if vehicle is None or vehicle.carrier_company_id != company_id:
        return None
    return vehicle


def _key_prefix(vehicle_id):
    return f'vehicles/{vehicle_id}/photo-'


def _own_key(vehicle):
    """La llave en S3 de la foto actual, si la subimos nosotros. Una URL que
    alguien escribió a mano (de antes) no es nuestra y no se borra."""
    prefix = _key_prefix(vehicle.id)
    picture = vehicle.picture or ''
    start = picture.find(prefix)
    return picture[start:] if start >= 0 else None


def _check_upload(content_type, size_bytes):
    if content_type not in CONTENT_TYPES:
        raise InvalidRequest('only JPG, PNG and WEBP photos are allowed')
    if isinstance(size_bytes, bool) or not isinstance(size_bytes, int) or size_bytes < 1:
        raise InvalidRequest('size_bytes must be a positive integer')
    if size_bytes > MAX_BYTES:
        raise InvalidRequest(f'photo too large (max {MAX_BYTES // (1024 * 1024)}MB)')


def _delete_quietly(storage, key):
    # La foto vieja que queda en el bucket no rompe nada: no se corta el cambio por eso.
    try:
        storage.delete(key)
    except Exception as e:
        current_app.logger.error(f'Vehicle photo delete error: {e}')


@api.route('/carrier-companies/<int:company_id>/vehicles/<int:vehicle_id>/photo/presign', methods=['POST'])
def presign_vehicle_photo(company_id, vehicle_id):
    if not is_internal_request():
        return _forbidden()
    if _vehicle(company_id, vehicle_id) is None:
        return jsonify({'message': 'vehicle not found'}), 404

    data = request.get_json(silent=True) or {}
    content_type = data.get('content_type')
    _check_upload(content_type, data.get('size_bytes'))

    storage_key = f'{_key_prefix(vehicle_id)}{uuid.uuid4().hex}.{CONTENT_TYPES[content_type]}'
    upload = get_storage().presigned_post(storage_key, content_type, MAX_BYTES)
    return jsonify({'upload': upload, 'storage_key': storage_key}), 200


@api.route('/carrier-companies/<int:company_id>/vehicles/<int:vehicle_id>/photo', methods=['POST'])
def register_vehicle_photo(company_id, vehicle_id):
    """Pone la foto subida como la del vehículo y borra la anterior."""
    if not is_internal_request():
        return _forbidden()
    vehicle = _vehicle(company_id, vehicle_id)
    if vehicle is None:
        return jsonify({'message': 'vehicle not found'}), 404

    data = request.get_json(silent=True) or {}
    storage_key = data.get('storage_key')
    prefix = _key_prefix(vehicle_id)
    # Solo una llave que se le dio a este vehículo.
    if (not isinstance(storage_key, str) or not storage_key.startswith(prefix)
            or '/' in storage_key[len(prefix):] or '..' in storage_key):
        raise InvalidRequest('invalid storage_key')

    storage = get_storage()
    previous = _own_key(vehicle)
    if previous == storage_key:
        return jsonify({'picture': vehicle.picture}), 200

    stored = storage.head(storage_key)
    if stored is None:
        raise InvalidRequest('file was not uploaded')
    # El presigned POST ya fija tipo y tamaño; esto revisa lo que de verdad quedó.
    try:
        _check_upload(stored['content_type'], stored['size'])
    except InvalidRequest:
        storage.delete(storage_key)
        raise

    vehicle.picture = storage.public_url(storage_key)
    db.session.commit()
    if previous:
        _delete_quietly(storage, previous)
    return jsonify({'picture': vehicle.picture}), 201


@api.route('/carrier-companies/<int:company_id>/vehicles/<int:vehicle_id>/photo', methods=['DELETE'])
def delete_vehicle_photo(company_id, vehicle_id):
    if not is_internal_request():
        return _forbidden()
    vehicle = _vehicle(company_id, vehicle_id)
    if vehicle is None:
        return jsonify({'message': 'vehicle not found'}), 404

    previous = _own_key(vehicle)
    vehicle.picture = None
    db.session.commit()
    if previous:
        _delete_quietly(get_storage(), previous)
    return '', 204
