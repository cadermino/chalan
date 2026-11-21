"""Cotización formal desde el detalle de una orden: solo admins, reenviada al
API principal con el token interno y con quién la generó."""
import jwt
import pytest

from app.models import AdminUser
from tests.test_service_requests import SECRET, make_user


class FakeResponse:
    def __init__(self, status_code, body=None, content=b'', headers=None):
        self.status_code = status_code
        self._body = body
        self.content = content
        self.headers = headers or {'Content-Type': 'application/json'}

    def json(self):
        if self._body is None:
            raise ValueError('no json')
        return self._body


@pytest.fixture
def main_api(monkeypatch):
    seen = {'calls': []}
    responses = {}

    def fake_request(method, url, headers, timeout, **kwargs):
        seen['calls'].append({'method': method, 'url': url, 'headers': headers, **kwargs})
        return responses[(method, url.split('/api/v1')[1])]
    monkeypatch.setattr('app.api.formal_quotations.requests.request', fake_request)
    monkeypatch.setenv('INTERNAL_API_URL', 'http://flask-api:8001')
    seen['responses'] = responses
    return seen


@pytest.mark.parametrize('role', ['carrier_company', 'real_estate_agent'])
def test_only_admins(client, main_api, role):
    headers = make_user(role)
    assert client.get('/api/orders/5/formal-quotations', headers=headers).status_code == 403
    assert client.post('/api/orders/5/formal-quotations', headers=headers, json={}).status_code == 403
    assert client.get('/api/formal-quotations/1/pdf', headers=headers).status_code == 403
    assert main_api['calls'] == []


def test_create_forwards_the_fields_and_who_and_relays_the_pdf(client, main_api):
    main_api['responses'][('POST', '/order/5/formal-quotations')] = FakeResponse(
        200, content=b'%PDF-1.4 x',
        headers={'Content-Type': 'application/pdf', 'X-Formal-Quotation-Id': '9',
                 'Content-Disposition': 'attachment; filename="Cotizacion_X_5_Chalan.pdf"'})
    headers = make_user('admin')
    admin_id = AdminUser.query.filter_by(role='admin').one().id

    res = client.post('/api/orders/5/formal-quotations', headers=headers, json={
        'quotation_id': 3, 'ruc': '20510042990', 'business_name': 'PMS', 'prices_include_igv': True,
        'admin_user_id': 999,  # lo pone el backoffice, no el navegador
    })

    assert res.status_code == 200
    assert res.data == b'%PDF-1.4 x'
    assert res.headers['X-Formal-Quotation-Id'] == '9'
    assert 'Cotizacion_X_5_Chalan.pdf' in res.headers['Content-Disposition']
    call = main_api['calls'][0]
    assert call['json'] == {'quotation_id': 3, 'ruc': '20510042990', 'business_name': 'PMS',
                            'prices_include_igv': True, 'admin_user_id': admin_id}
    token = call['headers']['Authorization'].split()[1]
    assert jwt.decode(token, SECRET, algorithms=['HS256'])['scope'] == 'internal'


def test_create_keeps_the_validation_error(client, main_api):
    main_api['responses'][('POST', '/order/5/formal-quotations')] = FakeResponse(
        400, {'message': 'invalid RUC', 'field': 'ruc'})

    res = client.post('/api/orders/5/formal-quotations', headers=make_user('superadmin'), json={'ruc': '1'})

    assert res.status_code == 400
    assert res.get_json() == {'message': 'invalid RUC', 'field': 'ruc'}


def test_the_list_names_who_made_each_one(client, main_api):
    headers = make_user('admin')
    admin = AdminUser.query.filter_by(role='admin').one()
    admin.first_name, admin.last_name = 'Carlos', 'Calderón'
    main_api['responses'][('GET', '/order/5/formal-quotations')] = FakeResponse(200, {
        'formal_quotations': [{'id': 2, 'created_by_admin_id': admin.id}, {'id': 1, 'created_by_admin_id': None}],
        'last_client': None, 'quotations': [],
    })

    body = client.get('/api/orders/5/formal-quotations', headers=headers).get_json()

    assert [r['created_by'] for r in body['formal_quotations']] == ['Carlos Calderón', 'El cliente']


def test_a_main_api_crash_is_502(client, main_api):
    main_api['responses'][('GET', '/formal-quotations/1/pdf')] = FakeResponse(500, headers={'Content-Type': 'text/html'})

    assert client.get('/api/formal-quotations/1/pdf', headers=make_user('admin')).status_code == 502
