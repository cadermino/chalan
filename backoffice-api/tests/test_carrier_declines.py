"""El transportista rechaza una orden (backoffice) o una solicitud (link público).

La escritura vive en el API principal: acá solo se prueba que el rol se controle,
que la empresa salga del usuario o del token y nunca del cuerpo, que la lista
del transportista oculte lo que rechazó y que el admin vea quién dijo que no.
"""
from datetime import datetime

import jwt
import pytest

from app import db
from app.models import Order, OrderCarrierDecline, ServiceRequestCarrierDecline
from tests.test_service_requests import (SECRET, FakeResponse, admin, carrier_token,  # noqa: F401
                                         make_carrier, make_user, materials, packing, submitted)


@pytest.fixture
def forwarded(monkeypatch):
    seen = {}

    def fake_request(method, url, json, headers, timeout):
        seen.update(method=method, url=url, json=json, headers=headers)
        return FakeResponse(200, {'decline': None})
    monkeypatch.setattr('app.api.orders.requests.request', fake_request)
    monkeypatch.setattr('app.api.service_requests.requests.request', fake_request)
    monkeypatch.setenv('INTERNAL_API_URL', 'http://flask-api:8001')
    return seen


@pytest.fixture
def carrier(app):
    return make_carrier(name='Mudanzas SAC')


@pytest.fixture
def carrier_user(carrier):
    return make_user('carrier_company', carrier_company_id=carrier.id)


def make_order(status=1):
    order = Order(order_status_id=status, created_date=datetime(2026, 10, 1))
    db.session.add(order)
    db.session.commit()
    return order


# --- órdenes ---------------------------------------------------------------------

def test_carrier_decline_is_forwarded_with_the_users_company(client, carrier, carrier_user, forwarded):
    order = make_order()

    res = client.post(f'/api/orders/{order.id}/decline', headers=carrier_user,
                      json={'reason': 'zone', 'note': 'Lejos', 'carrier_company_id': 999})

    assert res.status_code == 200
    assert forwarded['method'] == 'POST'
    assert forwarded['url'] == f'http://flask-api:8001/api/v1/order/{order.id}/decline'
    assert forwarded['json'] == {'carrier_company_id': carrier.id, 'reason': 'zone', 'note': 'Lejos'}
    token = forwarded['headers']['Authorization'].split()[1]
    assert jwt.decode(token, SECRET, algorithms=['HS256'])['scope'] == 'internal'


def test_undo_is_forwarded_as_delete(client, carrier, carrier_user, forwarded):
    order = make_order()

    client.delete(f'/api/orders/{order.id}/decline', headers=carrier_user)

    assert forwarded['method'] == 'DELETE'
    assert forwarded['json'] == {'carrier_company_id': carrier.id}


def test_only_carriers_can_decline_an_order(client, admin, forwarded):
    order = make_order()

    assert client.post(f'/api/orders/{order.id}/decline', headers=admin, json={'reason': 'zone'}).status_code == 403
    assert forwarded == {}


def test_carrier_list_hides_declined_orders_unless_asked(client, carrier, carrier_user):
    kept, declined = make_order(), make_order()
    db.session.add(OrderCarrierDecline(order_id=declined.id, carrier_company_id=carrier.id, reason='zone'))
    db.session.commit()

    default = client.get('/api/orders/pending', headers=carrier_user).get_json()['orders']
    assert [o['id'] for o in default] == [kept.id]

    everything = client.get('/api/orders/pending?declined=1', headers=carrier_user).get_json()['orders']
    assert {o['id']: o['declined'] for o in everything} == {kept.id: False, declined.id: True}


def test_another_carriers_decline_does_not_hide_the_order(client, carrier_user):
    order = make_order()
    other = make_carrier(name='Otra SAC')
    db.session.add(OrderCarrierDecline(order_id=order.id, carrier_company_id=other.id, reason='zone'))
    db.session.commit()

    orders = client.get('/api/orders/pending', headers=carrier_user).get_json()['orders']
    assert [(o['id'], o['declined']) for o in orders] == [(order.id, False)]


def test_detail_and_admin_quotations_show_the_decline(client, admin, carrier, carrier_user):
    order = make_order()
    db.session.add(OrderCarrierDecline(order_id=order.id, carrier_company_id=carrier.id,
                                       reason='other', note='No tengo gente'))
    db.session.commit()

    detail = client.get(f'/api/orders/{order.id}', headers=carrier_user).get_json()['order']
    assert detail['decline']['reason'] == 'other'

    declines = client.get(f'/api/orders/{order.id}/quotations', headers=admin).get_json()['declines']
    assert [(d['carrier_company_name'], d['reason'], d['note']) for d in declines] == [
        ('Mudanzas SAC', 'other', 'No tengo gente')]


# --- solicitudes de servicio ------------------------------------------------------

def test_public_decline_takes_the_company_from_the_link(client, submitted, carrier, forwarded):
    token = carrier_token(submitted.id, carrier.id)

    res = client.post(f'/api/public/service-requests/{token}/decline',
                      json={'reason': 'vehicle', 'carrier_company_id': 999})

    assert res.status_code == 200
    assert forwarded['url'] == f'http://flask-api:8001/api/v1/service-requests/{submitted.id}/decline'
    assert forwarded['json'] == {'carrier_company_id': carrier.id, 'reason': 'vehicle', 'note': None}


def test_public_decline_with_a_bad_link_never_reaches_the_main_api(client, submitted, forwarded):
    assert client.post('/api/public/service-requests/garbage/decline', json={'reason': 'zone'}).status_code == 404
    assert forwarded == {}


def test_carrier_view_and_admin_detail_show_the_decline(client, admin, submitted, carrier):
    db.session.add(ServiceRequestCarrierDecline(service_request_id=submitted.id,
                                                carrier_company_id=carrier.id, reason='zone'))
    db.session.commit()

    view = client.get(f'/api/public/service-requests/{carrier_token(submitted.id, carrier.id)}').get_json()
    assert view['service_request']['my_decline']['reason'] == 'zone'

    detail = client.get(f'/api/service-requests/{submitted.id}', headers=admin).get_json()
    assert [d['carrier_company_name'] for d in detail['service_request']['declines']] == ['Mudanzas SAC']
