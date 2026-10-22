"""Un superadmin corrige qué lleva una orden y el peso de una carga (migración
030): sin peso, una carga no sale a los transportistas."""
from datetime import datetime

import pytest

from app import db
from app.models import Order
from tests.test_service_requests import make_user


@pytest.fixture
def superadmin(app):
    return make_user('superadmin')


def make_order(**fields):
    order = Order(order_status_id=1, created_date=datetime(2026, 10, 22), **fields)
    db.session.add(order)
    db.session.commit()
    return order


def put(client, headers, order_id, body):
    return client.put(f'/api/orders/{order_id}', json=body, headers=headers)


def test_the_weight_of_a_cargo_is_saved(client, superadmin):
    order = make_order(load_type='cargo')

    res = put(client, superadmin, order.id, {'load_type': 'cargo', 'cargo_weight_kg': 3000})

    assert res.status_code == 200
    db.session.refresh(order)
    assert (order.load_type, order.cargo_weight_kg) == ('cargo', 3000)


def test_another_load_drops_the_weight(client, superadmin):
    order = make_order(load_type='cargo', cargo_weight_kg=3000)

    put(client, superadmin, order.id, {'load_type': 'items', 'cargo_weight_kg': 3000})

    db.session.refresh(order)
    assert (order.load_type, order.cargo_weight_kg) == ('items', None)


@pytest.mark.parametrize('body', [
    {'load_type': 'avion'},
    {'load_type': 'cargo', 'cargo_weight_kg': 1234},
])
def test_values_outside_the_lists_are_rejected(client, superadmin, body):
    order = make_order(load_type='moving')

    assert put(client, superadmin, order.id, body).status_code == 400
    db.session.refresh(order)
    assert order.load_type == 'moving'


def test_an_edit_without_load_fields_keeps_them(client, superadmin):
    order = make_order(load_type='cargo', cargo_weight_kg=500)

    put(client, superadmin, order.id, {'comments': 'sacos'})

    db.session.refresh(order)
    assert (order.load_type, order.cargo_weight_kg) == ('cargo', 500)


def test_the_order_detail_carries_the_load(client, superadmin):
    order = make_order(load_type='vehicle')

    data = client.get(f'/api/orders/{order.id}', headers=superadmin).get_json()

    assert data['order']['load_type'] == 'vehicle'
