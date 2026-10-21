"""Datos de contacto en vez de registro para ver las cotizaciones (paso 2 → 3).

Con un correo nuevo se crea el cliente sin contraseña y sale con sesión. Con
un correo que ya tiene cuenta no hay sesión: el link va a ese correo.
"""
import pytest

from app import db
from app.api import order_access
from app.models import Customer, Order


@pytest.fixture
def unowned_order(app):
    order = Order()
    db.session.add(order)
    db.session.commit()
    return order


@pytest.fixture
def sent(monkeypatch):
    emails = []
    monkeypatch.setattr('app.auth.auth_routes.send_email',
                        lambda to, subject, template, bcc, **kw: emails.append((to, template, kw)))
    return emails


def contact(client, order_id, **fields):
    payload = {'order_id': order_id, 'name': 'Rosa', 'email': 'Rosa@Example.com',
               'mobile_phone': '987654321'}
    payload.update(fields)
    return client.post('/api/auth/order-contact', json=payload)


def test_a_new_email_creates_the_customer_and_opens_a_session(client, unowned_order, sent):
    res = contact(client, unowned_order.id)

    assert res.status_code == 201
    body = res.get_json()
    customer = Customer.query.filter_by(email='rosa@example.com').one()
    assert customer.password_hash is None
    assert customer.mobile_phone == '987654321'
    assert db.session.get(Order, unowned_order.id).customer_id == customer.id
    assert Customer.verify_auth_token(body['token']).id == customer.id
    assert body['order_id'] == unowned_order.id
    # Solo el aviso interno de cliente nuevo; al cliente no se le manda nada.
    assert [t for _, t, _ in sent] == ['email/user_registered']


def test_the_session_can_read_the_order_quotations(client, unowned_order, sent):
    token = contact(client, unowned_order.id).get_json()['token']

    res = client.get(f'/api/v1/quotations/{unowned_order.id}',
                     headers={'Authorization': f'Bearer {token}'})

    assert res.status_code == 200


def test_an_existing_email_gets_the_link_instead_of_a_session(client, unowned_order, customer, sent, monkeypatch):
    monkeypatch.setenv('SITE_URL', 'https://chalan.pe')

    res = contact(client, unowned_order.id, email='NATHALIA@example.com', mobile_phone='911222333')

    assert res.status_code == 202
    body = res.get_json()
    assert 'token' not in body
    assert body['email'] == 'na***@example.com'
    order = db.session.get(Order, unowned_order.id)
    assert order.customer_id == customer.id
    assert order.lead_phone == '911222333'
    # Los datos de la cuenta no se pisan con lo que escribió un desconocido.
    assert db.session.get(Customer, customer.id).name == 'Nathalia'
    to, template, kw = sent[0]
    assert (to, template) == ('nathalia@example.com', 'email/order_access_link')
    link_token = kw['access_url'].rsplit('/', 1)[1]
    assert kw['access_url'].startswith('https://chalan.pe/acceso/')
    assert order_access.read_token(link_token)[0] == (order.id, customer.id)


def test_the_typed_phone_replaces_the_one_from_step_one(client, unowned_order, customer, sent):
    unowned_order.lead_phone = '900000000'
    db.session.commit()

    contact(client, unowned_order.id, email='nathalia@example.com', mobile_phone='911222333')

    assert db.session.get(Order, unowned_order.id).lead_phone == '911222333'
    assert db.session.get(Customer, customer.id).mobile_phone is None


def test_an_order_that_already_has_a_customer_is_not_taken(client, order, sent):
    res = contact(client, order.id, email='otra@example.com')

    assert res.status_code == 409
    assert Customer.query.filter_by(email='otra@example.com').first() is None
    assert sent == []


def test_a_missing_order_is_404(client, sent):
    assert contact(client, 9999).status_code == 404


@pytest.mark.parametrize('fields', [
    {'name': ''}, {'email': ''}, {'mobile_phone': ''}, {'order_id': None}, {'order_id': '12'},
])
def test_every_field_is_required(client, unowned_order, sent, fields):
    fields = {'order_id': unowned_order.id, **fields}
    assert contact(client, fields.pop('order_id'), **fields).status_code == 400


@pytest.mark.parametrize('email', ['rosa', 'rosa@', 'rosa@gmail', 'ro sa@gmail.com'])
def test_a_malformed_email_is_rejected(client, unowned_order, sent, email):
    res = contact(client, unowned_order.id, email=email)
    assert res.status_code == 400
    assert db.session.get(Order, unowned_order.id).customer_id is None
