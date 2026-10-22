import os

import requests
from flask import jsonify

from . import api
from .decorators import admin_required
from .orders import _internal_headers
from ..carrier_documents import make_token
from ..models import CarrierCompany
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
