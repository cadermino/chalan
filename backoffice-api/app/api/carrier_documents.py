import os

import requests
from flask import jsonify, request

from . import api
from .decorators import admin_required
from .orders import _internal_headers
from ..carrier_documents import make_token
from ..models import CarrierCompany, Vehicle
from .. import db


@api.route('/carrier-companies/<int:company_id>/documents', methods=['GET'])
@admin_required
def get_company_documents(company_id):
    """DNI/CE, licencia y tarjeta de propiedad que subió la empresa, con URLs para verlos.

    Los archivos y las URLs firmadas los tiene el API principal (dueño de S3);
    acá se controla el rol y se agrega el token del link para pedírselos al
    transportista (la página arma `{origin}/transportistas/documentos/{token}`).
    Las URLs vencen en una hora: la página las vuelve a pedir al abrirse.
    """
    if db.session.get(CarrierCompany, company_id) is None:
        return jsonify({'message': 'carrier company not found'}), 404
    internal_api = os.getenv('INTERNAL_API_URL', 'http://flask-api:8001')
    try:
        res = requests.get(
            f'{internal_api}/api/v1/carrier-companies/{company_id}/documents',
            headers=_internal_headers(),
            timeout=15,
        )
    except requests.RequestException:
        return jsonify({'message': 'could not reach the documents service'}), 502
    if res.status_code != 200:
        return jsonify({'message': 'failed to load the documents'}), 502
    return jsonify({
        'documents': res.json()['documents'],
        'upload_token': make_token(company_id),
    }), 200


def _forward(method, path, json=None):
    """Reenvía al API principal, que firma la subida a S3 y escribe
    carrier_documents. Devuelve su respuesta tal cual: sus mensajes (tipo,
    tamaño, máximo de archivos) son los que muestra el formulario."""
    internal_api = os.getenv('INTERNAL_API_URL', 'http://flask-api:8001')
    try:
        res = requests.request(
            method,
            f'{internal_api}/api/v1/carrier-companies/{path}',
            json=json,
            headers=_internal_headers(),
            timeout=30,
        )
    except requests.RequestException:
        return jsonify({'message': 'could not reach the documents service'}), 502
    if res.status_code == 204:
        return '', 204
    try:
        body = res.json()
    except ValueError:
        body = {'message': 'documents service error'}
    return jsonify(body), res.status_code


def _vehicle_missing(company_id, vehicle_id):
    vehicle = db.session.get(Vehicle, vehicle_id)
    return vehicle is None or vehicle.carrier_company_id != company_id


@api.route('/carrier-companies/<int:company_id>/vehicles/<int:vehicle_id>/card/presign', methods=['POST'])
@admin_required
def presign_vehicle_card(company_id, vehicle_id):
    """Firma la subida de la tarjeta de propiedad de un vehículo, directo del
    navegador a S3. Después el navegador la registra con POST .../card."""
    if _vehicle_missing(company_id, vehicle_id):
        return jsonify({'message': 'vehicle not found'}), 404
    return _forward('POST', f'{company_id}/vehicles/{vehicle_id}/card/presign', request.get_json(silent=True) or {})


@api.route('/carrier-companies/<int:company_id>/vehicles/<int:vehicle_id>/card', methods=['POST'])
@admin_required
def register_vehicle_card(company_id, vehicle_id):
    if _vehicle_missing(company_id, vehicle_id):
        return jsonify({'message': 'vehicle not found'}), 404
    return _forward('POST', f'{company_id}/vehicles/{vehicle_id}/card', request.get_json(silent=True) or {})


@api.route('/carrier-companies/<int:company_id>/documents/<int:document_id>', methods=['DELETE'])
@admin_required
def delete_company_document(company_id, document_id):
    """Borra un documento, también de una empresa ya activa (con el link, el
    transportista solo puede mientras espera la aprobación)."""
    return _forward('DELETE', f'{company_id}/documents/{document_id}')
