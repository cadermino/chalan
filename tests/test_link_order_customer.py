"""Enlazar cliente: el backoffice le pone cliente a una orden que no tiene.

Para quien dejó su WhatsApp en el paso 1 y dio nombre y correo por WhatsApp.
Lo que se prueba es lo que dejaría la orden mal enlazada: un correo con cuenta
que crea otra, el número de una cuenta pisado, una orden ajena reasignada, o
la ruta abierta a cualquiera.
"""
from app import db
from app.api.decorators import generate_internal_token
from app.models import Customer, Order


def internal():
    return {'Authorization': f'Bearer {generate_internal_token()}'}


def link(client, order_id, headers=None, **body):
    body = {'name': 'Carla Ruiz', 'email': 'carla@example.com', 'mobile_phone': '987654321', **body}
    return client.post(f'/api/v1/order/{order_id}/customer', json=body,
                       headers=internal() if headers is None else headers)


def anonymous_order(**fields):
    order = Order(**fields)
    db.session.add(order)
    db.session.commit()
    return order


def test_a_new_email_creates_the_customer_without_password(client):
    order = anonymous_order(lead_phone='955111222')

    res = link(client, order.id, email='  Carla@Example.com ')

    assert res.status_code == 201
    customer = Customer.query.filter_by(email='carla@example.com').one()
    assert res.get_json() == {'customer_id': customer.id, 'name': 'Carla Ruiz',
                              'email': 'carla@example.com', 'existing': False}
    assert (customer.name, customer.mobile_phone, customer.password_hash) == ('Carla Ruiz', '987654321', None)
    assert (order.customer_id, order.lead_phone) == (customer.id, '987654321')


def test_an_email_with_an_account_links_it_and_keeps_its_phone(client, customer):
    customer.mobile_phone = '911111111'
    db.session.commit()
    order = anonymous_order(lead_phone='955111222')

    res = link(client, order.id, email='NATHALIA@example.com', name='Otro nombre')

    assert res.status_code == 200
    assert res.get_json()['existing'] is True
    assert Customer.query.count() == 1
    assert (customer.name, customer.mobile_phone) == ('Nathalia', '911111111')
    assert (order.customer_id, order.lead_phone) == (customer.id, '987654321')


def test_an_order_that_has_a_customer_is_not_changed(client, order):
    owner = order.customer_id

    assert link(client, order.id).status_code == 409
    assert db.session.get(Order, order.id).customer_id == owner


def test_bad_data(client):
    order = anonymous_order()

    assert link(client, order.id, email='carla.example.com').status_code == 400
    assert link(client, order.id, name='  ').status_code == 400
    assert link(client, order.id, mobile_phone=None).status_code == 400
    assert link(client, 999999).status_code == 404
    assert order.customer_id is None


def test_only_internal_calls(client):
    order = anonymous_order()

    assert link(client, order.id, headers={}).status_code == 403
    assert order.customer_id is None
