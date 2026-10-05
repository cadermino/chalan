from datetime import date, datetime, timedelta, timezone

import jwt
import pytest
import requests as requests_lib

from app import db
from app.models import (AdminUser, CarrierCompany, CarrierCompanyServiceType, ServiceMaterial,
                        ServiceRequest, ServiceRequestItem, ServiceRequestNotification,
                        ServiceType)

SECRET = 'test-secret-key-at-least-32-bytes-long'


def make_user(role, **kwargs):
    user = AdminUser(email=f'{role}-{kwargs.get("suffix", "a")}@example.com', role=role, active=1,
                     carrier_company_id=kwargs.get('carrier_company_id'))
    user.password = 'testpass123'
    db.session.add(user)
    db.session.commit()
    return {'Authorization': f'Bearer {user.generate_auth_token()}'}


@pytest.fixture
def admin(app):
    return make_user('admin')


@pytest.fixture
def packing(app):
    packing_type = ServiceType(code='packing', name='Embalaje')
    db.session.add(packing_type)
    db.session.commit()
    return packing_type


@pytest.fixture
def materials(packing):
    rows = {
        'stretch_film': ServiceMaterial(service_type_id=packing.id, code='stretch_film', name='Film', position=2),
        'cardboard_sheet': ServiceMaterial(service_type_id=packing.id, code='cardboard_sheet', name='Cartón', position=1),
    }
    db.session.add_all(rows.values())
    db.session.commit()
    return rows


@pytest.fixture
def submitted(packing, materials):
    service_request = ServiceRequest(
        public_id='a' * 32, service_type_id=packing.id, status='submitted', whatsapp='+51987654321',
        preferred_date=date(2026, 10, 20), street='Av. Javier Prado 123', neighborhood='San Isidro',
        country='PE', map_url='https://maps.google.com/?cid=1', submitted_at=datetime(2026, 10, 5, 12, 0))
    service_request.items = [
        ServiceRequestItem(description='Sofá', quantity=2, position=0,
                           materials=[materials['stretch_film']]),
        ServiceRequestItem(description='TV', quantity=1, position=1,
                           materials=[materials['stretch_film'], materials['cardboard_sheet']]),
    ]
    db.session.add(service_request)
    db.session.commit()
    return service_request


def make_carrier(packing_type=None, active=1, name='Embala SAC'):
    carrier = CarrierCompany(name=name, active=active)
    db.session.add(carrier)
    db.session.commit()
    if packing_type is not None:
        db.session.add(CarrierCompanyServiceType(carrier_company_id=carrier.id, service_type_id=packing_type.id))
        db.session.commit()
    return carrier


def carrier_token(service_request_id, carrier_id, **overrides):
    now = datetime.now(timezone.utc)
    payload = {'purpose': 'service_request', 'service_request_id': service_request_id,
               'carrier_company_id': carrier_id, 'iat': now, 'exp': now + timedelta(days=10)}
    payload.update(overrides)
    return jwt.encode({k: v for k, v in payload.items() if v is not None}, SECRET, algorithm='HS256')


# --- catalog ---------------------------------------------------------------

def test_service_types_lists_only_active_ones(client, admin, packing):
    db.session.add(ServiceType(code='old', name='Viejo', active=0))
    db.session.commit()

    res = client.get('/api/service-types', headers=admin)

    assert res.status_code == 200
    assert [t['code'] for t in res.get_json()['service_types']] == ['packing']


def test_service_types_requires_login(client):
    assert client.get('/api/service-types').status_code == 401


# --- admin list and detail --------------------------------------------------

def test_list_requires_an_admin_role(client, submitted):
    carrier = make_carrier()
    headers = make_user('carrier_company', carrier_company_id=carrier.id)

    assert client.get('/api/service-requests').status_code == 401
    assert client.get('/api/service-requests', headers=headers).status_code == 403


def test_list_filters_by_status_and_counts_related_rows(client, admin, submitted, packing):
    db.session.add(ServiceRequest(public_id='b' * 32, service_type_id=packing.id, status='draft'))
    carrier = make_carrier(packing)
    db.session.add(ServiceRequestNotification(service_request_id=submitted.id, carrier_company_id=carrier.id))
    db.session.commit()

    everything = client.get('/api/service-requests', headers=admin).get_json()['service_requests']
    only_submitted = client.get('/api/service-requests?status=submitted', headers=admin).get_json()['service_requests']

    assert len(everything) == 2
    assert [r['id'] for r in only_submitted] == [submitted.id]
    row = only_submitted[0]
    assert (row['items_count'], row['media_count'], row['notified_count']) == (2, 0, 1)
    assert row['preferred_date'] == '2026-10-20'
    assert row['neighborhood'] == 'San Isidro'


def test_list_rejects_an_unknown_status(client, admin):
    assert client.get('/api/service-requests?status=nope', headers=admin).status_code == 400


def test_detail_has_whatsapp_materials_summary_and_links_for_offering_carriers(client, admin, submitted, packing):
    offering = make_carrier(packing, name='Ofrece SAC')
    make_carrier(packing, active=0, name='Dormido SAC')
    make_carrier(None, name='Sin servicio SAC')
    db.session.add(ServiceRequestNotification(service_request_id=submitted.id, carrier_company_id=offering.id))
    db.session.commit()

    res = client.get(f'/api/service-requests/{submitted.id}', headers=admin)

    assert res.status_code == 200
    data = res.get_json()['service_request']
    assert data['whatsapp'] == '+51987654321'
    # Film is on both items (2 + 1 units); cardboard only on the TV.
    assert data['materials_summary'] == [
        {'code': 'cardboard_sheet', 'name': 'Cartón', 'items': 1, 'quantity': 1},
        {'code': 'stretch_film', 'name': 'Film', 'items': 2, 'quantity': 3},
    ]
    assert [(l['name'], l['notified']) for l in data['links']] == [('Ofrece SAC', True)]
    payload = jwt.decode(data['links'][0]['token'], SECRET, algorithms=['HS256'])
    assert payload['purpose'] == 'service_request'
    assert payload['service_request_id'] == submitted.id
    assert [n['carrier_company_name'] for n in data['notifications']] == ['Ofrece SAC']


def test_detail_of_a_missing_request_is_404(client, admin):
    assert client.get('/api/service-requests/999', headers=admin).status_code == 404


# --- cancel -----------------------------------------------------------------

def test_admin_can_cancel_a_request(client, admin, submitted):
    res = client.patch(f'/api/service-requests/{submitted.id}', json={'status': 'cancelled'}, headers=admin)

    assert res.status_code == 200
    assert db.session.get(ServiceRequest, submitted.id).status == 'cancelled'


@pytest.mark.parametrize('body', [{'status': 'draft'}, {'status': 'submitted'}, {'whatsapp': '+51999999999'}, {}])
def test_only_cancelling_is_allowed(client, admin, submitted, body):
    res = client.patch(f'/api/service-requests/{submitted.id}', json=body, headers=admin)

    assert res.status_code == 400
    assert db.session.get(ServiceRequest, submitted.id).status == 'submitted'


# --- resend through the main API ----------------------------------------------

class FakeResponse:
    def __init__(self, status_code, body):
        self.status_code = status_code
        self._body = body

    def json(self):
        return self._body


def test_notify_carriers_proxies_to_the_main_api_with_an_internal_token(client, admin, submitted, monkeypatch):
    seen = {}

    def fake_post(url, headers, timeout):
        seen.update(url=url, headers=headers)
        return FakeResponse(200, {'notified_carrier_ids': [7]})
    monkeypatch.setattr('app.api.service_requests.requests.post', fake_post)
    monkeypatch.setenv('INTERNAL_API_URL', 'http://flask-api:8001')

    res = client.post(f'/api/service-requests/{submitted.id}/notify-carriers', headers=admin)

    assert res.status_code == 200
    assert res.get_json() == {'notified_carrier_ids': [7]}
    assert seen['url'] == f'http://flask-api:8001/api/v1/service-requests/{submitted.id}/notify-carriers'
    token = seen['headers']['Authorization'].split()[1]
    assert jwt.decode(token, SECRET, algorithms=['HS256'])['scope'] == 'internal'


def test_notify_carriers_passes_a_409_through(client, admin, submitted, monkeypatch):
    monkeypatch.setattr('app.api.service_requests.requests.post',
                        lambda *a, **k: FakeResponse(409, {'message': 'only submitted requests can be sent to carriers'}))

    res = client.post(f'/api/service-requests/{submitted.id}/notify-carriers', headers=admin)

    assert res.status_code == 409


def test_notify_carriers_is_502_when_the_main_api_is_down(client, admin, submitted, monkeypatch):
    def boom(*args, **kwargs):
        raise requests_lib.ConnectionError('down')
    monkeypatch.setattr('app.api.service_requests.requests.post', boom)

    assert client.post(f'/api/service-requests/{submitted.id}/notify-carriers', headers=admin).status_code == 502


def test_notify_carriers_requires_an_admin_role(client, submitted):
    carrier = make_carrier()
    headers = make_user('carrier_company', carrier_company_id=carrier.id)

    assert client.post(f'/api/service-requests/{submitted.id}/notify-carriers', headers=headers).status_code == 403


# --- the public carrier view ----------------------------------------------------

def test_carrier_view_shows_the_request_without_the_customers_whatsapp(client, submitted, packing):
    carrier = make_carrier(packing, name='Ofrece SAC')

    res = client.get(f'/api/public/service-requests/{carrier_token(submitted.id, carrier.id)}')

    assert res.status_code == 200
    data = res.get_json()['service_request']
    assert data['carrier_company_name'] == 'Ofrece SAC'
    assert data['preferred_date'] == '2026-10-20'
    assert data['street'] == 'Av. Javier Prado 123'
    assert [(i['description'], i['quantity'], [m['code'] for m in i['materials']]) for i in data['items']] == [
        ('Sofá', 2, ['stretch_film']), ('TV', 1, ['cardboard_sheet', 'stretch_film'])]
    assert data['materials_summary'][1] == {'code': 'stretch_film', 'name': 'Film', 'items': 2, 'quantity': 3}
    assert 'whatsapp' not in data
    assert '987654321' not in res.get_data(as_text=True)


def test_carrier_view_needs_no_login_and_never_answers_401(client, submitted):
    for token in ('garbage', carrier_token(submitted.id, 1, exp=datetime.now(timezone.utc) - timedelta(days=1))):
        assert client.get(f'/api/public/service-requests/{token}').status_code != 401


def test_expired_link_is_410(client, submitted):
    token = carrier_token(submitted.id, 1, exp=datetime.now(timezone.utc) - timedelta(minutes=1))

    assert client.get(f'/api/public/service-requests/{token}').status_code == 410


def test_garbage_and_foreign_signature_are_404(client, submitted):
    forged = jwt.encode({'purpose': 'service_request', 'service_request_id': submitted.id,
                         'carrier_company_id': 1}, 'another-secret-another-secret-123456', algorithm='HS256')

    assert client.get('/api/public/service-requests/garbage').status_code == 404
    assert client.get(f'/api/public/service-requests/{forged}').status_code == 404


def test_a_quotation_token_cannot_open_a_service_request(client, submitted):
    # Same SECRET_KEY, same shape as the order quotation links, but no `purpose`.
    quotation_token = jwt.encode(
        {'carrier_company_id': 1, 'order_id': submitted.id,
         'exp': datetime.now(timezone.utc) + timedelta(days=1)}, SECRET, algorithm='HS256')

    assert client.get(f'/api/public/service-requests/{quotation_token}').status_code == 404


def test_link_to_a_missing_request_is_404(client):
    assert client.get(f'/api/public/service-requests/{carrier_token(999, 1)}').status_code == 404


def test_link_to_a_draft_is_404(client, packing):
    draft = ServiceRequest(public_id='c' * 32, service_type_id=packing.id, status='draft')
    db.session.add(draft)
    db.session.commit()

    assert client.get(f'/api/public/service-requests/{carrier_token(draft.id, 1)}').status_code == 404


def test_a_cancelled_request_is_still_shown_with_its_status(client, submitted):
    submitted.status = 'cancelled'
    db.session.commit()

    res = client.get(f'/api/public/service-requests/{carrier_token(submitted.id, 1)}')

    assert res.status_code == 200
    assert res.get_json()['service_request']['status'] == 'cancelled'


# --- which services a carrier company offers -------------------------------------

def test_admin_sets_the_services_a_company_offers(client, admin, packing):
    carrier = make_carrier()

    res = client.put(f'/api/carrier-companies/{carrier.id}', json={'service_type_ids': [packing.id]}, headers=admin)

    assert res.status_code == 200
    assert res.get_json()['carrier_company']['service_type_ids'] == [packing.id]
    fetched = client.get(f'/api/carrier-companies/{carrier.id}', headers=admin).get_json()
    assert fetched['carrier_company']['service_type_ids'] == [packing.id]


def test_an_empty_list_clears_the_services(client, admin, packing):
    carrier = make_carrier(packing)

    res = client.put(f'/api/carrier-companies/{carrier.id}', json={'service_type_ids': []}, headers=admin)

    assert res.get_json()['carrier_company']['service_type_ids'] == []
    assert CarrierCompanyServiceType.query.count() == 0


def test_updating_without_the_field_keeps_the_services(client, admin, packing):
    carrier = make_carrier(packing)

    res = client.put(f'/api/carrier-companies/{carrier.id}', json={'name': 'Nuevo nombre'}, headers=admin)

    assert res.get_json()['carrier_company']['service_type_ids'] == [packing.id]


def test_a_company_cannot_change_its_own_services(client, packing):
    carrier = make_carrier()
    headers = make_user('carrier_company', carrier_company_id=carrier.id)

    res = client.put(f'/api/carrier-companies/{carrier.id}', json={'service_type_ids': [packing.id]}, headers=headers)

    assert res.status_code == 403
    assert CarrierCompanyServiceType.query.count() == 0


@pytest.mark.parametrize('ids', [[999], 'packing', [True]])
def test_invalid_service_type_ids_are_rejected(client, admin, packing, ids):
    carrier = make_carrier()

    res = client.put(f'/api/carrier-companies/{carrier.id}', json={'service_type_ids': ids}, headers=admin)

    assert res.status_code == 400


def test_creating_a_company_can_set_its_services(client, admin, packing):
    res = client.post('/api/carrier-companies', json={'name': 'Nueva SAC', 'service_type_ids': [packing.id]},
                      headers=admin)

    assert res.status_code == 201
    assert res.get_json()['carrier_company']['service_type_ids'] == [packing.id]


# --- manual creation --------------------------------------------------------------

def test_service_materials_are_listed_in_order_and_skip_inactive(client, admin, packing, materials):
    db.session.add(ServiceMaterial(service_type_id=packing.id, code='old', name='Viejo', position=0, active=0))
    db.session.commit()

    res = client.get('/api/service-types/packing/materials', headers=admin)

    assert res.status_code == 200
    assert [m['code'] for m in res.get_json()['materials']] == ['cardboard_sheet', 'stretch_film']


def test_service_materials_of_an_unknown_service_is_404(client, admin):
    assert client.get('/api/service-types/nope/materials', headers=admin).status_code == 404


def test_manual_creation_forwards_the_body_to_the_main_api_with_an_internal_token(client, admin, monkeypatch):
    seen = {}

    def fake_post(url, json, headers, timeout):
        seen.update(url=url, json=json, headers=headers)
        return FakeResponse(201, {'id': 5, 'public_id': 'x' * 32, 'notified_carrier_ids': [1]})
    monkeypatch.setattr('app.api.service_requests.requests.post', fake_post)
    monkeypatch.setenv('INTERNAL_API_URL', 'http://flask-api:8001')

    res = client.post('/api/service-requests', json={'service_type': 'packing', 'whatsapp': '987654321'}, headers=admin)

    assert res.status_code == 201
    assert res.get_json()['id'] == 5
    assert seen['url'] == 'http://flask-api:8001/api/v1/service-requests/manual'
    assert seen['json'] == {'service_type': 'packing', 'whatsapp': '987654321'}
    token = seen['headers']['Authorization'].split()[1]
    assert jwt.decode(token, SECRET, algorithms=['HS256'])['scope'] == 'internal'


def test_manual_creation_passes_validation_errors_through(client, admin, monkeypatch):
    monkeypatch.setattr('app.api.service_requests.requests.post',
                        lambda *a, **k: FakeResponse(400, {'message': 'address.map_url is required'}))

    res = client.post('/api/service-requests', json={}, headers=admin)

    assert res.status_code == 400
    assert res.get_json()['message'] == 'address.map_url is required'


def test_manual_creation_is_502_when_the_main_api_is_down(client, admin, monkeypatch):
    def boom(*args, **kwargs):
        raise requests_lib.ConnectionError('down')
    monkeypatch.setattr('app.api.service_requests.requests.post', boom)

    assert client.post('/api/service-requests', json={}, headers=admin).status_code == 502


def test_manual_creation_requires_an_admin_role(client):
    carrier = make_carrier()
    headers = make_user('carrier_company', carrier_company_id=carrier.id)

    assert client.post('/api/service-requests', json={}).status_code == 401
    assert client.post('/api/service-requests', json={}, headers=headers).status_code == 403
