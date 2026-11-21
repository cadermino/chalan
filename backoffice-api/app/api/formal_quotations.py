"""Cotización formal en PDF (con RUC) desde el detalle de una orden.

Solo admins. La arma el API principal (`app/api/formal_quotations.py`); acá se
controla el rol y se reenvía con el token interno, sumando quién la generó.
"""
import os

import requests
from flask import Response, g, jsonify, request

from . import api
from .decorators import login_required
from .orders import _internal_headers
from ..models import AdminUser, ROLE_ADMIN, ROLE_SUPERADMIN

# Lo que el admin puede mandar; lo demás (p. ej. admin_user_id) lo pone esto.
FIELDS = ('quotation_id', 'ruc', 'business_name', 'contact_name', 'contact_email',
          'prices_include_igv', 'include_reservation')
# Los encabezados del PDF que el navegador necesita para nombrar el archivo.
PDF_HEADERS = ('Content-Disposition', 'X-Formal-Quotation-Id')


def _is_admin():
    return g.current_user.role in (ROLE_SUPERADMIN, ROLE_ADMIN)


def _forbidden():
    return jsonify({'message': 'forbidden'}), 403


def _main_api(method, path, **kwargs):
    internal_api = os.getenv('INTERNAL_API_URL', 'http://flask-api:8001')
    return requests.request(method, f'{internal_api}/api/v1{path}', headers=_internal_headers(),
                            timeout=30, **kwargs)


def _relay(res):
    """La respuesta del API principal tal cual: el PDF o su error en JSON."""
    if res.headers.get('Content-Type', '').startswith('application/pdf'):
        headers = {h: res.headers[h] for h in PDF_HEADERS if h in res.headers}
        headers['Access-Control-Expose-Headers'] = ', '.join(PDF_HEADERS)
        return Response(res.content, status=res.status_code, mimetype='application/pdf', headers=headers)
    try:
        body = res.json()
    except ValueError:
        body = {'message': 'the order service failed'}
    return jsonify(body), (res.status_code if res.status_code < 500 else 502)


@api.route('/orders/<int:order_id>/formal-quotations', methods=['GET'])
@login_required
def list_order_formal_quotations(order_id):
    if not _is_admin():
        return _forbidden()
    try:
        res = _main_api('GET', f'/order/{order_id}/formal-quotations')
    except requests.RequestException:
        return jsonify({'message': 'could not reach the order service'}), 502
    if res.status_code != 200:
        return _relay(res)
    body = res.json()
    admin_ids = {r['created_by_admin_id'] for r in body['formal_quotations'] if r.get('created_by_admin_id')}
    names = {a.id: ' '.join(filter(None, [a.first_name, a.last_name])) or a.email
             for a in AdminUser.query.filter(AdminUser.id.in_(admin_ids))} if admin_ids else {}
    for row in body['formal_quotations']:
        row['created_by'] = names.get(row.get('created_by_admin_id')) if row.get('created_by_admin_id') \
            else 'El cliente'
    return jsonify(body), 200


@api.route('/orders/<int:order_id>/formal-quotations', methods=['POST'])
@login_required
def create_order_formal_quotation(order_id):
    if not _is_admin():
        return _forbidden()
    data = request.get_json(silent=True) or {}
    payload = {key: data[key] for key in FIELDS if key in data}
    payload['admin_user_id'] = g.current_user.id
    try:
        res = _main_api('POST', f'/order/{order_id}/formal-quotations', json=payload)
    except requests.RequestException:
        return jsonify({'message': 'could not reach the order service'}), 502
    return _relay(res)


@api.route('/formal-quotations/<int:formal_quotation_id>/pdf', methods=['GET'])
@login_required
def formal_quotation_pdf(formal_quotation_id):
    if not _is_admin():
        return _forbidden()
    try:
        res = _main_api('GET', f'/formal-quotations/{formal_quotation_id}/pdf')
    except requests.RequestException:
        return jsonify({'message': 'could not reach the order service'}), 502
    return _relay(res)
