"""Link del cliente (abre su orden sin contraseña) y alta de clientes sin contraseña.

El token lo canjea el API principal (`POST /api/auth/order-access`), así que
aquí se comprueba que tenga exactamente el formato que ese API espera: la
misma sal, la misma clave y [order_id, customer_id].
"""
from datetime import datetime

import jwt
import pytest
from itsdangerous import URLSafeTimedSerializer

from app import db
from app.models import CarrierCompany, Customer, Order, Quotation
from tests.test_service_requests import SECRET, admin, make_user  # noqa: F401


@pytest.fixture
def customer(app):
    row = Customer(name='Rosa', email='rosa@example.com', mobile_phone='+51987654321')
    db.session.add(row)
    db.session.commit()
    return row


def make_order(customer_id=None, status=1):
    order = Order(order_status_id=status, created_date=datetime(2026, 10, 20), customer_id=customer_id)
    db.session.add(order)
    db.session.commit()
    return order


def link(client, headers, order_id):
    return client.get(f'/api/orders/{order_id}/customer-link', headers=headers)


def test_the_token_has_the_format_the_main_api_reads(client, admin, customer):
    order = make_order(customer.id)

    res = link(client, admin, order.id)

    assert res.status_code == 200
    token = res.get_json()['token']
    assert URLSafeTimedSerializer(SECRET, salt='order-access').loads(token) == [order.id, customer.id]


def test_an_order_without_customer_has_no_link(client, admin):
    assert link(client, admin, make_order().id).status_code == 409


def test_a_missing_order_is_404(client, admin):
    assert link(client, admin, 9999).status_code == 404


def test_only_admins_get_the_link(client, customer):
    order = make_order(customer.id)
    assert link(client, make_user('carrier_company', suffix='c'), order.id).status_code == 403
    assert link(client, make_user('real_estate_agent', suffix='r'), order.id).status_code == 403
    assert client.get(f'/api/orders/{order.id}/customer-link').status_code == 401


# --- crear cliente sin contraseña ------------------------------------------------

class FakeResponse:
    status_code = 201

    def json(self):
        import jwt
        return {'token': jwt.encode({'id': 7}, SECRET, algorithm='HS256'),
                'name': 'Rosa', 'email': 'rosa@example.com'}


def test_creating_a_customer_sends_no_password_and_the_internal_token(client, monkeypatch):
    sent = {}

    def fake_post(url, json=None, headers=None, timeout=None):
        sent.update(url=url, json=json, headers=headers)
        return FakeResponse()

    monkeypatch.setattr('app.api.customers.requests.post', fake_post)
    superadmin = make_user('superadmin', suffix='s')

    res = client.post('/api/customers', headers=superadmin,
                      json={'name': 'Rosa', 'email': 'rosa@example.com', 'mobile_phone': '+51987654321'})

    assert res.status_code == 201 and res.get_json()['customer_id'] == 7
    assert sent['url'].endswith('/api/auth/register')
    assert 'password' not in sent['json']
    assert sent['headers']['Authorization'].startswith('Bearer ')


def test_the_review_link_is_marked_as_a_review(client, admin, customer):
    # El API principal solo acepta como reseña un token con purpose=review: el
    # link de cotizar del transportista trae order_id y carrier_company_id.
    order = make_order(customer.id, status=3)
    company = CarrierCompany(name='Gana SAC', rfc='', email='', address='', active=1)
    db.session.add(company)
    db.session.commit()
    db.session.add(Quotation(order_id=order.id, carrier_company_id=company.id, amount=300, quotation_status_id=2))
    db.session.commit()

    res = client.get(f'/api/orders/{order.id}/review-link', headers=admin)

    payload = jwt.decode(res.get_json()['token'], SECRET, algorithms=['HS256'])
    assert payload['purpose'] == 'review'
    assert (payload['order_id'], payload['customer_id'], payload['carrier_company_id']) == (order.id, customer.id, company.id)
