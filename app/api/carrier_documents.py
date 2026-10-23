"""Documentos que sube un transportista para que lo validemos.

DNI o carné de extranjería, licencia de conducir y tarjeta de propiedad
(tarjeta de identificación vehicular). Antes se pedían por WhatsApp a cada
transportista que se registraba en la landing; ahora los sube él mismo con un
link firmado, sin sesión: la cuenta nace inactiva y no puede entrar al
backoffice hasta que un admin la apruebe, que es justo lo que estos
documentos deciden.

El link lleva el id de la empresa firmado con SECRET_KEY (itsdangerous, sal
`carrier-documents`). Lo arma el backoffice-api al registrar y en el botón
"Copiar link de documentos" (`backoffice-api/app/carrier_documents.py`): si
cambia el formato aquí, hay que cambiarlo allá.

Los archivos van directo del navegador a S3 (presigned POST), igual que las
fotos de las solicitudes de servicio. La política del bucket solo abre a
cualquiera `orders/` y `service-requests/`; `carrier-documents/` queda
privado y el backoffice los ve con URLs firmadas que vencen en una hora. No
lo agregues a esa política: serían DNIs a la vista de quien tenga la URL.

Cada vehículo tiene su tarjeta: el vehículo va en la llave del archivo
(`vehicle_card-v<id>-…`). Con el link, el transportista sube la del primer
vehículo de la empresa (el registro crea uno en blanco); los de más los crea
un admin, que sube su tarjeta desde el backoffice (rutas internas, abajo).
"""
import os
import re
import uuid

from flask import current_app, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from . import api
from .decorators import is_internal_request
from .email import send_email
from .service_request.validation import InvalidRequest
from .. import db
from ..models import CarrierCompany, CarrierDocument, Vehicle
from ..storage import get_storage

SALT = 'carrier-documents'
# Quien se registra un domingo puede no tener la licencia a mano: el link
# tiene que durar hasta que vuelva a mirar el correo.
MAX_AGE = 30 * 24 * 3600

DOC_TYPES = ('identity', 'driver_license', 'vehicle_card')
DOC_LABELS = {
    'identity': 'DNI o carné de extranjería',
    'driver_license': 'Licencia de conducir',
    'vehicle_card': 'Tarjeta de propiedad',
}
# Frente y reverso, y alguna repetición si la primera salió borrosa.
MAX_PER_TYPE = 4
MAX_BYTES = 10 * 1024 * 1024
# HEIC no: el backoffice no lo puede mostrar en Chrome. La landing convierte
# las fotos a JPEG antes de subirlas, así que solo llega HEIC si eso falla.
CONTENT_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
}
KEY_PREFIX = 'carrier-documents'
VIEW_URL_TTL = 3600


def _serializer():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=SALT)


def make_token(company_id):
    return _serializer().dumps(company_id)


def read_token(token):
    """(company_id, None), o (None, motivo) con motivo 'expired' o 'invalid'."""
    try:
        company_id = _serializer().loads(token, max_age=MAX_AGE)
    except SignatureExpired:
        return None, 'expired'
    except (BadSignature, ValueError, TypeError):
        return None, 'invalid'
    if isinstance(company_id, bool) or not isinstance(company_id, int):
        return None, 'invalid'
    return company_id, None


def _company_from(token):
    """(empresa, None) o (None, respuesta de error)."""
    company_id, reason = read_token(token)
    if company_id is None:
        return None, (jsonify({'message': 'invalid link', 'reason': reason}), 401)
    company = db.session.get(CarrierCompany, company_id)
    if company is None:
        return None, (jsonify({'message': 'carrier company not found', 'reason': 'invalid'}), 404)
    return company, None


def _documents_of(company_id):
    return (CarrierDocument.query.filter_by(carrier_company_id=company_id)
            .order_by(CarrierDocument.id).all())


def _to_dict(document):
    return {
        'id': document.id,
        'doc_type': document.doc_type,
        'vehicle_id': document.vehicle_id,
        'content_type': document.content_type,
        'size_bytes': document.size_bytes,
        'created_date': document.created_date.isoformat() if document.created_date else None,
    }


def _key_parts(company_id, storage_key):
    """(doc_type, vehicle_id) de una llave que esta empresa recibió al pedir la subida, o None.

    La llave es `carrier-documents/<empresa>/<doc_type>-<uuid>.<ext>`, y la
    tarjeta lleva además su vehículo: `vehicle_card-v<vehículo>-<uuid>.<ext>`.
    El tipo y el vehículo van en la llave para que no se pueda presignar un DNI
    y registrarlo como tarjeta, ni la tarjeta de un camión en otro, ni el
    archivo de otra empresa. vehicle_id es None si la llave no lo trae.
    """
    prefix = f'{KEY_PREFIX}/{company_id}/'
    if not isinstance(storage_key, str) or not storage_key.startswith(prefix):
        return None
    name = storage_key[len(prefix):]
    if '/' in name or '..' in name:
        return None
    doc_type = name.split('-', 1)[0]
    if doc_type not in DOC_TYPES:
        return None
    vehicle = re.match(r'vehicle_card-v(\d+)-', name) if doc_type == 'vehicle_card' else None
    return doc_type, int(vehicle.group(1)) if vehicle else None


def _company_vehicle(company_id, vehicle_id):
    return Vehicle.query.filter_by(id=vehicle_id, carrier_company_id=company_id).first()


def _vehicle_for_card(company_id):
    """Vehículo al que va la tarjeta que sube el transportista: el primero de la empresa.

    El registro crea la empresa con un vehículo en blanco, que es el que el
    admin llena con los datos de esta tarjeta.
    """
    vehicle = (Vehicle.query.filter_by(carrier_company_id=company_id)
               .order_by(Vehicle.id).first())
    return vehicle.id if vehicle else None


def _count(company_id, doc_type, vehicle_id):
    """Archivos de ese documento: por empresa, o por vehículo si es la tarjeta."""
    query = CarrierDocument.query.filter_by(carrier_company_id=company_id, doc_type=doc_type)
    if doc_type == 'vehicle_card':
        query = query.filter(CarrierDocument.vehicle_id == vehicle_id)
    return query.count()


def _notify_complete(company):
    """Avisa al equipo la primera vez que la empresa tiene los tres documentos."""
    send_email(
        os.getenv('ADMIN_MAIL'),
        'Transportista subió sus documentos',
        'email/carrier_documents_complete',
        bcc='',
        company=company,
        backoffice_url=f"{(os.getenv('SITE_URL') or '').rstrip('/')}/backoffice/carrier-companies/{company.id}/edit",
    )


def _presign(company, doc_type, vehicle_id):
    data = request.get_json(silent=True) or {}
    content_type = data.get('content_type')
    if content_type not in CONTENT_TYPES:
        raise InvalidRequest('file type not allowed')
    size_bytes = data.get('size_bytes')
    if isinstance(size_bytes, bool) or not isinstance(size_bytes, int) or size_bytes < 1:
        raise InvalidRequest('size_bytes must be a positive integer')
    if size_bytes > MAX_BYTES:
        raise InvalidRequest(f'file too large (max {MAX_BYTES // (1024 * 1024)}MB)')
    if _count(company.id, doc_type, vehicle_id) >= MAX_PER_TYPE:
        raise InvalidRequest(f'at most {MAX_PER_TYPE} files per document')

    name = f'{doc_type}-v{vehicle_id}' if doc_type == 'vehicle_card' and vehicle_id else doc_type
    storage_key = f'{KEY_PREFIX}/{company.id}/{name}-{uuid.uuid4().hex}.{CONTENT_TYPES[content_type]}'
    upload = get_storage().presigned_post(storage_key, content_type, MAX_BYTES)
    return jsonify({'upload': upload, 'storage_key': storage_key}), 200


def _register(company, storage_key, vehicle_id=None, notify=True):
    """Registra un archivo ya subido. Con vehicle_id, solo la tarjeta de ese vehículo."""
    parts = _key_parts(company.id, storage_key)
    if parts is None:
        raise InvalidRequest('invalid storage_key')
    doc_type, key_vehicle_id = parts
    if vehicle_id is not None and (doc_type != 'vehicle_card' or key_vehicle_id != vehicle_id):
        raise InvalidRequest('invalid storage_key')
    if doc_type == 'vehicle_card':
        if key_vehicle_id is None:
            # Llaves de antes de la tarjeta por vehículo: van al primero, como antes.
            key_vehicle_id = _vehicle_for_card(company.id)
        elif _company_vehicle(company.id, key_vehicle_id) is None:
            raise InvalidRequest('invalid storage_key')

    existing = CarrierDocument.query.filter_by(storage_key=storage_key).first()
    if existing is not None:
        return jsonify(_to_dict(existing)), 200

    storage = get_storage()
    stored = storage.head(storage_key)
    if stored is None:
        raise InvalidRequest('file was not uploaded')

    # El presigned POST ya fija tipo y tamaño; esto revisa lo que de verdad
    # quedó en el bucket, porque el registro es lo que el resto cree.
    problem = None
    if stored['content_type'] not in CONTENT_TYPES:
        problem = 'file type not allowed'
    elif stored['size'] > MAX_BYTES:
        problem = 'file too large'
    elif _count(company.id, doc_type, key_vehicle_id) >= MAX_PER_TYPE:
        problem = f'at most {MAX_PER_TYPE} files per document'
    if problem is not None:
        storage.delete(storage_key)
        raise InvalidRequest(problem)

    types_before = {d.doc_type for d in _documents_of(company.id)}
    document = CarrierDocument(
        carrier_company_id=company.id,
        vehicle_id=key_vehicle_id,
        doc_type=doc_type,
        storage_key=storage_key,
        content_type=stored['content_type'],
        size_bytes=stored['size'],
    )
    db.session.add(document)
    db.session.commit()

    if notify and types_before != set(DOC_TYPES) and types_before | {doc_type} == set(DOC_TYPES):
        _notify_complete(company)
    return jsonify(_to_dict(document)), 201


def _delete(company_id, document_id):
    document = CarrierDocument.query.filter_by(id=document_id, carrier_company_id=company_id).first()
    if document is None:
        return jsonify({'message': 'document not found'}), 404
    try:
        get_storage().delete(document.storage_key)
    except Exception as e:
        current_app.logger.error(f'Carrier document delete error: {e}')
        return jsonify({'message': 'Error deleting file'}), 500
    db.session.delete(document)
    db.session.commit()
    return '', 204


@api.route('/carrier-documents/<token>', methods=['GET'])
def get_carrier_documents(token):
    company, error = _company_from(token)
    if error:
        return error
    return jsonify({
        'company_name': company.name,
        'documents': [_to_dict(d) for d in _documents_of(company.id)],
        'max_per_type': MAX_PER_TYPE,
        'can_delete': not company.active,
    }), 200


@api.route('/carrier-documents/<token>/presign', methods=['POST'])
def presign_carrier_document(token):
    company, error = _company_from(token)
    if error:
        return error
    doc_type = (request.get_json(silent=True) or {}).get('doc_type')
    if doc_type not in DOC_TYPES:
        raise InvalidRequest('doc_type must be one of ' + ', '.join(DOC_TYPES))
    vehicle_id = _vehicle_for_card(company.id) if doc_type == 'vehicle_card' else None
    return _presign(company, doc_type, vehicle_id)


@api.route('/carrier-documents/<token>', methods=['POST'])
def register_carrier_document(token):
    company, error = _company_from(token)
    if error:
        return error
    return _register(company, (request.get_json(silent=True) or {}).get('storage_key'))


@api.route('/carrier-documents/<token>/<int:document_id>', methods=['DELETE'])
def delete_carrier_document(token, document_id):
    company, error = _company_from(token)
    if error:
        return error
    # Mientras espera la aprobación puede corregir una foto borrosa. Ya
    # aprobado, los documentos son lo que se validó: no se borran con el link.
    if company.active:
        return jsonify({'message': 'company is already active'}), 409
    return _delete(company.id, document_id)


# Para el backoffice-api, que ya revisó que sea admin: ver los documentos y
# subir o borrar la tarjeta de cualquier vehículo, también de una empresa activa.

def _internal_company(company_id):
    """(empresa, None) o (None, respuesta de error)."""
    if not is_internal_request():
        return None, (jsonify({'message': 'forbidden'}), 403)
    company = db.session.get(CarrierCompany, company_id)
    if company is None:
        return None, (jsonify({'message': 'carrier company not found'}), 404)
    return company, None


@api.route('/carrier-companies/<int:company_id>/documents', methods=['GET'])
def list_company_documents(company_id):
    """Documentos de una empresa con URLs para verlos. Solo para el backoffice-api."""
    if not is_internal_request():
        return jsonify({'message': 'forbidden'}), 403
    storage = get_storage()
    return jsonify({'documents': [
        {**_to_dict(d), 'url': storage.presigned_get(d.storage_key, VIEW_URL_TTL)}
        for d in _documents_of(company_id)
    ]}), 200


@api.route('/carrier-companies/<int:company_id>/vehicles/<int:vehicle_id>/card/presign', methods=['POST'])
def presign_vehicle_card(company_id, vehicle_id):
    company, error = _internal_company(company_id)
    if error:
        return error
    if _company_vehicle(company_id, vehicle_id) is None:
        return jsonify({'message': 'vehicle not found'}), 404
    return _presign(company, 'vehicle_card', vehicle_id)


@api.route('/carrier-companies/<int:company_id>/vehicles/<int:vehicle_id>/card', methods=['POST'])
def register_vehicle_card(company_id, vehicle_id):
    company, error = _internal_company(company_id)
    if error:
        return error
    if _company_vehicle(company_id, vehicle_id) is None:
        return jsonify({'message': 'vehicle not found'}), 404
    # La sube el equipo: no tiene sentido avisarle por correo que está completa.
    return _register(company, (request.get_json(silent=True) or {}).get('storage_key'),
                     vehicle_id=vehicle_id, notify=False)


@api.route('/carrier-companies/<int:company_id>/documents/<int:document_id>', methods=['DELETE'])
def delete_company_document(company_id, document_id):
    company, error = _internal_company(company_id)
    if error:
        return error
    return _delete(company.id, document_id)
