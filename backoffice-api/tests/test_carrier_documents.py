"""Documentos del transportista: el link al registrarse y la vista del admin.

Los archivos los recibe y los firma el API principal (dueño de S3); acá se
prueba que el registro entregue el link correcto y que el backoffice los pida
con un token interno, solo para admins.
"""
import pytest
from itsdangerous import URLSafeTimedSerializer

from app import db
from app.models import CarrierCompany, Vehicle
from tests.test_service_requests import FakeResponse, admin, make_user  # noqa: F401

SECRET = 'test-secret-key-at-least-32-bytes-long'


def _read(token):
    return URLSafeTimedSerializer(SECRET, salt='carrier-documents').loads(token)


@pytest.fixture
def emails(monkeypatch):
    sent = []
    monkeypatch.setattr('app.auth.routes.send_email',
                        lambda to, subject, template, **kw: sent.append({'to': to, 'template': template, **kw}))
    monkeypatch.setenv('COUNTRY_ID', '2')
    monkeypatch.setenv('SITE_URL', 'https://chalan.pe/')
    return sent


def _register(client, **overrides):
    payload = {'first_name': 'Juan', 'last_name': 'Perez', 'dni': '12345678',
               'email': 'juan@example.com', 'password': 'testpass123',
               'phone': '987654321', 'role': 'carrier_company', **overrides}
    return client.post('/auth/register', json=payload)


def test_registering_a_carrier_hands_out_the_documents_link(client, emails):
    res = _register(client)

    assert res.status_code == 201
    company = CarrierCompany.query.filter_by(email='juan@example.com').first()
    assert _read(res.get_json()['documents_token']) == company.id

    request_email = next(e for e in emails if e['template'] == 'email/carrier_documents_request')
    assert request_email['to'] == 'juan@example.com'
    token = request_email['documents_url'].rsplit('/', 1)[1]
    assert request_email['documents_url'].startswith('https://chalan.pe/transportistas/documentos/')
    assert _read(token) == company.id


def test_a_real_estate_agent_gets_no_documents_link(client, emails):
    res = _register(client, role='real_estate_agent', email='agent@example.com')

    assert res.status_code == 201
    assert 'documents_token' not in res.get_json()
    assert emails == []


@pytest.fixture
def company(app):
    company = CarrierCompany(name='Juan Perez', active=0)
    db.session.add(company)
    db.session.commit()
    return company


def test_admins_get_the_documents_from_the_main_api(client, admin, company, monkeypatch):
    seen = {}

    def fake_get(url, headers, timeout):
        seen.update(url=url, headers=headers)
        return FakeResponse(200, {'documents': [{'id': 1, 'doc_type': 'identity', 'url': 'https://s3/x?sig'}]})
    monkeypatch.setattr('app.api.carrier_documents.requests.get', fake_get)
    monkeypatch.setenv('INTERNAL_API_URL', 'http://flask-api:8001')

    res = client.get(f'/api/carrier-companies/{company.id}/documents', headers=admin)

    assert res.status_code == 200
    assert seen['url'] == f'http://flask-api:8001/api/v1/carrier-companies/{company.id}/documents'
    assert seen['headers']['Authorization'].startswith('Bearer ')
    assert res.get_json()['documents'][0]['doc_type'] == 'identity'
    assert _read(res.get_json()['upload_token']) == company.id


def test_carriers_cannot_see_the_documents(client, company):
    headers = make_user('carrier_company', suffix='c', carrier_company_id=company.id)
    assert client.get(f'/api/carrier-companies/{company.id}/documents', headers=headers).status_code == 403


@pytest.fixture
def vehicle(company):
    vehicle = Vehicle(carrier_company_id=company.id, active=1)
    db.session.add(vehicle)
    db.session.commit()
    return vehicle


@pytest.fixture
def forwarded(monkeypatch):
    calls = []

    def fake_request(method, url, json, headers, timeout):
        calls.append({'method': method, 'url': url, 'json': json, 'headers': headers})
        if method == 'DELETE':
            return FakeResponse(204, None)
        return FakeResponse(201, {'id': 9, 'doc_type': 'vehicle_card'})
    monkeypatch.setattr('app.api.carrier_documents.requests.request', fake_request)
    monkeypatch.setenv('INTERNAL_API_URL', 'http://flask-api:8001')
    return calls


def test_admins_upload_a_vehicle_card_through_the_main_api(client, admin, company, vehicle, forwarded):
    base = f'/api/carrier-companies/{company.id}/vehicles/{vehicle.id}/card'

    assert client.post(f'{base}/presign', json={'content_type': 'image/jpeg', 'size_bytes': 10},
                       headers=admin).status_code == 201
    assert client.post(base, json={'storage_key': 'k'}, headers=admin).status_code == 201
    assert client.delete(f'/api/carrier-companies/{company.id}/documents/9', headers=admin).status_code == 204

    main = f'http://flask-api:8001/api/v1/carrier-companies/{company.id}'
    assert [(c['method'], c['url']) for c in forwarded] == [
        ('POST', f'{main}/vehicles/{vehicle.id}/card/presign'),
        ('POST', f'{main}/vehicles/{vehicle.id}/card'),
        ('DELETE', f'{main}/documents/9'),
    ]
    assert forwarded[0]['json'] == {'content_type': 'image/jpeg', 'size_bytes': 10}
    assert all(c['headers']['Authorization'].startswith('Bearer ') for c in forwarded)


def test_a_vehicle_of_another_company_is_not_forwarded(client, admin, company, forwarded):
    other = CarrierCompany(name='Otra', active=1)
    db.session.add(other)
    db.session.flush()
    foreign = Vehicle(carrier_company_id=other.id, active=1)
    db.session.add(foreign)
    db.session.commit()

    res = client.post(f'/api/carrier-companies/{company.id}/vehicles/{foreign.id}/card/presign',
                      json={'content_type': 'image/jpeg', 'size_bytes': 10}, headers=admin)

    assert res.status_code == 404
    assert forwarded == []


def test_carriers_cannot_upload_or_delete_documents(client, company, vehicle, forwarded):
    headers = make_user('carrier_company', suffix='c', carrier_company_id=company.id)

    assert client.post(f'/api/carrier-companies/{company.id}/vehicles/{vehicle.id}/card/presign',
                       json={}, headers=headers).status_code == 403
    assert client.delete(f'/api/carrier-companies/{company.id}/documents/9', headers=headers).status_code == 403
    assert forwarded == []
