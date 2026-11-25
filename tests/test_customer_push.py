"""Avisos push al cliente cuando llega una cotización (app/api/customer_push.py)."""
import json

import pytest

from app import db
from app.api import carrier_push
from app.api.carrier_company import CarrierCompany as CarrierCompanyEntity
from app.models import CarrierCompany, Customer, CustomerPushSubscription

PUBLIC = 'B' + 'A' * 86
P256DH = 'B' + 'x' * 86
AUTH = 'y' * 22
FCM = 'https://fcm.googleapis.com/fcm/send/cliente1'


@pytest.fixture(autouse=True)
def setup(monkeypatch):
    monkeypatch.setenv('WEB_PUSH_PUBLIC_KEY', PUBLIC)
    monkeypatch.setenv('WEB_PUSH_PRIVATE_KEY', 'private-key-for-tests')
    monkeypatch.setenv('PLATFORM_FEE', '0.1')
    monkeypatch.setenv('SITE_URL', 'https://chalan.pe')
    monkeypatch.setattr('app.api.quotations.send_email', lambda *a, **kw: None)
    monkeypatch.setattr('app.api.quotations.send_whatsapp', lambda *a, **kw: None)


@pytest.fixture
def sent(monkeypatch):
    calls = []
    monkeypatch.setattr(carrier_push, '_send', lambda info, payload: calls.append((info['endpoint'], json.loads(payload))) or (201, None))
    return calls


def _session(customer):
    return {'Authorization': f'Bearer {customer.generate_auth_token(3600)}'}


def _subscribe(client, customer, endpoint=FCM):
    body = {'endpoint': endpoint, 'keys': {'p256dh': P256DH, 'auth': AUTH}}
    return client.post('/api/v1/customer-push-subscriptions', json=body, headers=_session(customer))


def _quote(client, order, company, amount=380):
    token = CarrierCompanyEntity().generate_carrier_company_token(3600, order.id, company.id)
    return client.post('/api/v1/quotations', json={'amount': amount}, headers={'Authorization': f'Bearer {token}'})


@pytest.fixture
def pending(order):
    order.order_status_id = 1
    db.session.commit()
    return order


def _company(name):
    company = CarrierCompany(name=name, active=1)
    db.session.add(company)
    db.session.commit()
    return company


def test_the_customer_subscribes_with_its_session(client, customer):
    assert _subscribe(client, customer).status_code == 201
    assert _subscribe(client, customer).status_code == 200   # el mismo buzón se actualiza

    row = CustomerPushSubscription.query.one()
    assert (row.customer_id, row.vapid_public_key) == (customer.id, PUBLIC)


def test_without_a_session_or_with_a_strange_inbox_nothing_is_saved(client, customer):
    body = {'endpoint': FCM, 'keys': {'p256dh': P256DH, 'auth': AUTH}}
    assert client.post('/api/v1/customer-push-subscriptions', json=body).status_code == 401
    assert _subscribe(client, customer, endpoint='https://evil.example.com/x').status_code == 400
    assert CustomerPushSubscription.query.count() == 0


def test_the_same_phone_signing_in_as_another_customer_moves_to_it(client, customer):
    other = Customer(name='Otra', email='otra@example.com')
    db.session.add(other)
    db.session.commit()
    _subscribe(client, customer)
    _subscribe(client, other)

    assert [r.customer_id for r in CustomerPushSubscription.query.all()] == [other.id]


def test_each_new_quotation_reaches_the_customer_with_its_total(client, customer, pending, sent):
    _subscribe(client, customer)

    assert _quote(client, pending, _company('Uno'), 380).status_code == 201
    assert _quote(client, pending, _company('Dos'), 400).status_code == 201

    (_, first), (_, second) = sent
    assert first['title'] == f'Nueva cotización para tu orden {pending.id}'
    # Lo que ve el cliente: el precio del transportista más la comisión.
    assert first['body'] == 'S/ 418. Toca para verla.'
    assert second['body'] == 'S/ 440. Ya tienes 2: toca para compararlas.'
    assert first['tag'] == second['tag'] == f'customer-order-{pending.id}'
    assert first['url'].startswith('https://chalan.pe/acceso/') and first['url'].endswith('?r=push')


def test_a_requote_does_not_notify_again(client, customer, pending, sent):
    _subscribe(client, customer)
    company = _company('Uno')
    _quote(client, pending, company, 380)
    _quote(client, pending, company, 350)

    assert len(sent) == 1


def test_other_customers_and_other_keys_get_nothing(client, customer, pending, sent, monkeypatch):
    other = Customer(name='Otra', email='otra@example.com')
    db.session.add(other)
    db.session.commit()
    _subscribe(client, other)
    _quote(client, pending, _company('Uno'))
    assert sent == []

    # Una base copiada a otro entorno, con otra clave, no le escribe a ese celular.
    _subscribe(client, customer)
    monkeypatch.setenv('WEB_PUSH_PUBLIC_KEY', 'B' + 'C' * 86)
    _quote(client, pending, _company('Dos'))
    assert sent == []


def test_a_failing_push_does_not_break_the_quotation(client, customer, pending, monkeypatch):
    _subscribe(client, customer)
    monkeypatch.setattr('app.api.customer_push.new_quotation_message', lambda *a: 1 / 0)

    assert _quote(client, pending, _company('Uno')).status_code == 201
