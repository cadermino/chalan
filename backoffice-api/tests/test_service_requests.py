from datetime import date, datetime, timedelta, timezone

import jwt
import pytest
import requests as requests_lib

from app import db
from app.models import (AdminUser, CarrierCompany, CarrierCompanyServiceType, ServiceMaterial,
                        ServiceRequest, ServiceRequestItem, ServiceRequestNotification,
                        ServiceRequestQuotation, ServiceType)

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


# --- carrier quotations ----------------------------------------------------------------

def make_quotation(service_request, carrier, amount, note=None, status='active', total=None, rate=None):
    quotation = ServiceRequestQuotation(
        service_request_id=service_request.id, carrier_company_id=carrier.id, amount=amount,
        note=note, status=status, total_amount=total, platform_fee_rate=rate)
    db.session.add(quotation)
    db.session.commit()
    return quotation


@pytest.fixture(autouse=True)
def _platform_fee(monkeypatch):
    monkeypatch.setenv('PLATFORM_FEE', '0.1')


def public_get(client, service_request, carrier):
    token = carrier_token(service_request.id, carrier.id)
    return client.get(f'/api/public/service-requests/{token}')


def test_carrier_view_has_no_quotation_until_they_send_one(client, submitted, packing):
    carrier = make_carrier(packing)

    data = public_get(client, submitted, carrier).get_json()['service_request']

    assert (data['quotation_state'], data['my_quotation']) == ('open', None)


def test_carrier_view_returns_only_their_own_quotation(client, submitted, packing):
    mine, other = make_carrier(packing, name='Mia SAC'), make_carrier(packing, name='Ajena SAC')
    make_quotation(submitted, mine, 300, note='Incluye cajas')
    make_quotation(submitted, other, 180.5, note='Secreto de la otra')

    res = public_get(client, submitted, mine)

    data = res.get_json()['service_request']
    assert data['quotation_state'] == 'open'
    assert (data['my_quotation']['amount'], data['my_quotation']['note']) == (300.0, 'Incluye cajas')
    body = res.get_data(as_text=True)
    assert 'Ajena SAC' not in body and '180.5' not in body and 'Secreto de la otra' not in body


def test_state_when_the_carrier_was_selected_and_when_another_was(client, submitted, packing):
    winner, loser = make_carrier(packing, name='Gana SAC'), make_carrier(packing, name='Pierde SAC')
    make_quotation(submitted, winner, 300, status='selected', total=330, rate=0.1)
    make_quotation(submitted, loser, 280)

    assert public_get(client, submitted, winner).get_json()['service_request']['quotation_state'] == 'selected_mine'
    other_view = public_get(client, submitted, loser).get_json()['service_request']
    assert other_view['quotation_state'] == 'selected_other'
    # Pierde ve su propio precio, pero nada de lo del ganador.
    assert other_view['my_quotation']['amount'] == 280.0
    assert '300' not in str(other_view) and 'Gana SAC' not in str(other_view)


def test_a_cancelled_request_reports_cancelled_even_if_one_was_selected(client, submitted, packing):
    carrier = make_carrier(packing)
    make_quotation(submitted, carrier, 300, status='selected', total=330, rate=0.1)
    submitted.status = 'cancelled'
    db.session.commit()

    assert public_get(client, submitted, carrier).get_json()['service_request']['quotation_state'] == 'cancelled'


def post_quotation(client, token, body, monkeypatch=None, response=None):
    seen = {}

    def fake_post(url, json, headers, timeout):
        seen.update(url=url, json=json, headers=headers)
        return response or FakeResponse(201, {'id': 1, 'amount': 350.0, 'created': True})
    if monkeypatch is not None:
        monkeypatch.setattr('app.api.service_requests.requests.post', fake_post)
    res = client.post(f'/api/public/service-requests/{token}/quotation', json=body)
    return res, seen


def test_sending_a_price_forwards_it_with_the_carrier_taken_from_the_token(client, submitted, packing, monkeypatch):
    carrier = make_carrier(packing)
    monkeypatch.setenv('INTERNAL_API_URL', 'http://flask-api:8001')

    res, seen = post_quotation(
        client, carrier_token(submitted.id, carrier.id),
        # The browser tries to quote as another company and to smuggle extra fields.
        {'amount': '350', 'note': 'Incluye cajas', 'carrier_company_id': 999, 'status': 'selected'},
        monkeypatch)

    assert res.status_code == 201
    assert seen['url'] == f'http://flask-api:8001/api/v1/service-requests/{submitted.id}/quotations'
    assert seen['json'] == {'carrier_company_id': carrier.id, 'amount': '350', 'note': 'Incluye cajas'}
    token = seen['headers']['Authorization'].split()[1]
    assert jwt.decode(token, SECRET, algorithms=['HS256'])['scope'] == 'internal'


@pytest.mark.parametrize('status, body', [
    (400, {'message': 'amount must be a number between 0 and 100000'}),
    (404, {'message': 'carrier company not found'}),
    (409, {'message': 'service request already assigned'}),
    (200, {'id': 1, 'amount': 320.0, 'created': False}),
])
def test_sending_a_price_passes_the_main_api_answer_through(client, submitted, packing, monkeypatch, status, body):
    carrier = make_carrier(packing)

    res, _ = post_quotation(client, carrier_token(submitted.id, carrier.id), {'amount': 1}, monkeypatch,
                            FakeResponse(status, body))

    assert (res.status_code, res.get_json()) == (status, body)


def test_sending_a_price_is_502_when_the_main_api_is_down_or_answers_oddly(client, submitted, packing, monkeypatch):
    carrier = make_carrier(packing)
    token = carrier_token(submitted.id, carrier.id)

    res, _ = post_quotation(client, token, {'amount': 1}, monkeypatch, FakeResponse(500, {}))
    assert res.status_code == 502

    def boom(*args, **kwargs):
        raise requests_lib.ConnectionError('down')
    monkeypatch.setattr('app.api.service_requests.requests.post', boom)
    assert client.post(f'/api/public/service-requests/{token}/quotation', json={'amount': 1}).status_code == 502


def test_sending_a_price_checks_the_link_and_never_answers_401(client, submitted, packing, monkeypatch):
    carrier = make_carrier(packing)
    draft = ServiceRequest(public_id='d' * 32, service_type_id=packing.id, status='draft')
    db.session.add(draft)
    db.session.commit()
    expired = carrier_token(submitted.id, carrier.id, exp=datetime.now(timezone.utc) - timedelta(minutes=1))
    quotation_token = jwt.encode({'carrier_company_id': carrier.id, 'order_id': submitted.id,
                                  'exp': datetime.now(timezone.utc) + timedelta(days=1)}, SECRET, algorithm='HS256')
    calls = []
    monkeypatch.setattr('app.api.service_requests.requests.post', lambda *a, **k: calls.append(1))

    answers = {
        'garbage': client.post('/api/public/service-requests/garbage/quotation', json={'amount': 1}).status_code,
        'expired': client.post(f'/api/public/service-requests/{expired}/quotation', json={'amount': 1}).status_code,
        'order token': client.post(f'/api/public/service-requests/{quotation_token}/quotation', json={'amount': 1}).status_code,
        'draft': client.post(f'/api/public/service-requests/{carrier_token(draft.id, carrier.id)}/quotation',
                             json={'amount': 1}).status_code,
    }

    assert answers == {'garbage': 404, 'expired': 410, 'order token': 404, 'draft': 404}
    assert calls == []  # an invalid link never reaches the main API


def test_admin_detail_lists_quotations_cheapest_first_with_the_total_for_the_customer(client, admin, submitted, packing):
    dear, cheap = make_carrier(packing, name='Cara SAC'), make_carrier(packing, name='Barata SAC')
    make_quotation(submitted, dear, 400, note='Todo incluido')
    make_quotation(submitted, cheap, 100)

    data = client.get(f'/api/service-requests/{submitted.id}', headers=admin).get_json()['service_request']

    assert [(q['carrier_company_name'], q['amount'], q['total_amount']) for q in data['quotations']] == [
        ('Barata SAC', 100.0, 110.0), ('Cara SAC', 400.0, 440.0)]
    assert data['quotations'][1]['note'] == 'Todo incluido'
    assert data['platform_fee_rate'] == 0.1
    assert data['quotations'][0]['platform_fee_rate'] == 0.1


def test_a_selected_quotation_keeps_its_frozen_total_when_the_fee_changes(client, admin, submitted, packing, monkeypatch):
    carrier, other = make_carrier(packing, name='Elegida SAC'), make_carrier(packing, name='Otra SAC')
    make_quotation(submitted, carrier, 100, status='selected', total=110, rate=0.1)
    make_quotation(submitted, other, 200)
    monkeypatch.setenv('PLATFORM_FEE', '0.25')

    data = client.get(f'/api/service-requests/{submitted.id}', headers=admin).get_json()['service_request']

    by_name = {q['carrier_company_name']: q for q in data['quotations']}
    assert (by_name['Elegida SAC']['total_amount'], by_name['Elegida SAC']['platform_fee_rate']) == (110.0, 0.1)
    # The one not picked yet follows the current fee.
    assert (by_name['Otra SAC']['total_amount'], by_name['Otra SAC']['platform_fee_rate']) == (250.0, 0.25)


def test_total_for_the_customer_rounds_half_up_to_cents(client, admin, submitted, packing):
    carrier = make_carrier(packing)
    make_quotation(submitted, carrier, 350.50)  # 350.50 * 1.1 = 385.55 exactly

    data = client.get(f'/api/service-requests/{submitted.id}', headers=admin).get_json()['service_request']

    assert data['quotations'][0]['total_amount'] == 385.55


def test_list_shows_how_many_quotations_and_the_lowest(client, admin, submitted, packing):
    one, two = make_carrier(packing, name='Uno SAC'), make_carrier(packing, name='Dos SAC')
    make_quotation(submitted, one, 250)
    make_quotation(submitted, two, 180.5)
    empty = ServiceRequest(public_id='e' * 32, service_type_id=packing.id, status='submitted')
    db.session.add(empty)
    db.session.commit()

    rows = {r['id']: r for r in client.get('/api/service-requests', headers=admin).get_json()['service_requests']}

    assert (rows[submitted.id]['quotations_count'], rows[submitted.id]['min_amount']) == (2, 180.5)
    assert (rows[empty.id]['quotations_count'], rows[empty.id]['min_amount']) == (0, None)


def test_selecting_forwards_to_the_main_api_with_the_admin_who_picked(client, submitted, packing, monkeypatch):
    seen = {}

    def fake_post(url, json, headers, timeout):
        seen.update(url=url, json=json, headers=headers)
        return FakeResponse(200, {'id': 5, 'status': 'selected', 'total_amount': 110.0})
    monkeypatch.setattr('app.api.service_requests.requests.post', fake_post)
    monkeypatch.setenv('INTERNAL_API_URL', 'http://flask-api:8001')
    admin_headers = make_user('admin', suffix='quien-elige')
    admin_id = AdminUser.query.filter_by(email='admin-quien-elige@example.com').one().id

    res = client.post(f'/api/service-requests/{submitted.id}/quotations/5/select', headers=admin_headers)

    assert res.status_code == 200
    assert seen['url'] == f'http://flask-api:8001/api/v1/service-requests/{submitted.id}/quotations/5/select'
    assert seen['json'] == {'admin_user_id': admin_id}
    assert jwt.decode(seen['headers']['Authorization'].split()[1], SECRET, algorithms=['HS256'])['scope'] == 'internal'


@pytest.mark.parametrize('status', [404, 409])
def test_selecting_passes_not_found_and_conflict_through(client, admin, submitted, monkeypatch, status):
    monkeypatch.setattr('app.api.service_requests.requests.post',
                        lambda *a, **k: FakeResponse(status, {'message': 'nope'}))

    res = client.post(f'/api/service-requests/{submitted.id}/quotations/5/select', headers=admin)

    assert (res.status_code, res.get_json()['message']) == (status, 'nope')


def test_selecting_is_502_when_the_main_api_fails(client, admin, submitted, monkeypatch):
    monkeypatch.setattr('app.api.service_requests.requests.post', lambda *a, **k: FakeResponse(500, {}))
    assert client.post(f'/api/service-requests/{submitted.id}/quotations/5/select', headers=admin).status_code == 502

    def boom(*args, **kwargs):
        raise requests_lib.ConnectionError('down')
    monkeypatch.setattr('app.api.service_requests.requests.post', boom)
    assert client.post(f'/api/service-requests/{submitted.id}/quotations/5/select', headers=admin).status_code == 502


def test_selecting_requires_an_admin_role(client, submitted):
    carrier = make_carrier()
    headers = make_user('carrier_company', carrier_company_id=carrier.id)

    assert client.post(f'/api/service-requests/{submitted.id}/quotations/5/select').status_code == 401
    assert client.post(f'/api/service-requests/{submitted.id}/quotations/5/select', headers=headers).status_code == 403


# --- services column in the companies list ---------------------------------------------

def test_companies_list_includes_the_services_each_one_offers(client, admin, packing):
    embala = make_carrier(packing, name='Embala SAC')
    solo_mudanza = make_carrier(None, name='Solo mudanza SAC')

    rows = {c['id']: c for c in client.get('/api/carrier-companies', headers=admin).get_json()['carrier_companies']}

    assert [t['code'] for t in rows[embala.id]['service_types']] == ['packing']
    assert rows[embala.id]['service_types'][0]['name'] == 'Embalaje'
    assert rows[solo_mudanza.id]['service_types'] == []


def test_companies_list_skips_services_that_were_taken_down(client, admin, packing):
    carrier = make_carrier(packing)
    packing.active = 0
    db.session.commit()

    rows = client.get('/api/carrier-companies', headers=admin).get_json()['carrier_companies']

    assert rows[0]['service_types'] == []


def test_a_company_user_still_sees_only_their_own_company_with_its_services(client, packing):
    own = make_carrier(packing, name='Propia SAC')
    make_carrier(packing, name='Ajena SAC')
    headers = make_user('carrier_company', carrier_company_id=own.id)

    rows = client.get('/api/carrier-companies', headers=headers).get_json()['carrier_companies']

    assert [(c['name'], [t['code'] for t in c['service_types']]) for c in rows] == [('Propia SAC', ['packing'])]
