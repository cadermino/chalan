"""Qué lleva una orden (migración 030): mudanza, objetos sueltos, carga o un
vehículo, y el peso cuando es carga."""
from datetime import datetime

import pytest

from app import db
from app.api.order import Order as OrderEntity
from app.api.order.steps.belongings_appointment_date import BelongingsAppointmentDate
from app.api.orders import _missing_fields_for_quotation
from app.models import LuServices, Order


ORIGIN = {
    'from_street': 'Av. Javier Prado 123',
    'from_floor_number': 1,
    'from_country': 'Peru',
    'from_map_url': 'https://maps.google.com/x',
}
DESTINATION = {
    'to_street': 'Calle Mercaderes 456',
    'to_floor_number': 1,
    'to_country': 'Peru',
    'to_map_url': 'https://maps.google.com/y',
}


@pytest.fixture(autouse=True)
def _seed_services(app):
    db.session.add_all([
        LuServices(service='cargo', description='Cargadores'),
        LuServices(service='packaging', description='Embalaje'),
    ])
    db.session.commit()


def _create(client, customer, order=None):
    body = {
        'customer': {'customer_id': customer.id},
        'orderDetailsOrigin': ORIGIN,
        'orderDetailsDestination': DESTINATION,
    }
    if order is not None:
        body['order'] = order
    return client.post('/api/v1/order', json=body).get_json()['order_id']


def _update_payload(**order):
    return {
        'customer': {'customer_id': None},
        'order': {
            'appointment_date': datetime(2026, 8, 20, 14, 0),
            'comments': '200 sacos de arroz de 50 kg',
            'approximate_budget': 0,
            **order,
        },
        'orderDetailsOrigin': ORIGIN,
        'orderDetailsDestination': DESTINATION,
        'services': {'cargo': '0', 'packaging': '0'},
    }


def test_the_load_type_is_saved_when_the_order_is_created(client, customer):
    order_id = _create(client, customer, {'load_type': 'cargo', 'cargo_weight_kg': 10000})

    order = db.session.get(Order, order_id)
    assert (order.load_type, order.cargo_weight_kg) == ('cargo', 10000)


def test_an_order_created_without_a_load_type_has_none(client, customer):
    # El agente de cotizaciones y las órdenes de antes no lo mandan.
    order = db.session.get(Order, _create(client, customer))

    assert order.load_type is None


def test_an_unknown_load_type_is_not_saved(client, customer):
    order = db.session.get(Order, _create(client, customer, {'load_type': 'avion'}))

    assert order.load_type is None


def test_a_weight_outside_the_ranges_is_not_saved(client, customer):
    order_id = _create(client, customer, {'load_type': 'cargo', 'cargo_weight_kg': 1234})

    assert db.session.get(Order, order_id).cargo_weight_kg is None


def test_only_a_cargo_keeps_its_weight(client, customer):
    order_id = _create(client, customer, {'load_type': 'cargo', 'cargo_weight_kg': 3000})

    OrderEntity(order_id).update(_update_payload(load_type='moving', cargo_weight_kg=3000))

    order = db.session.get(Order, order_id)
    assert (order.load_type, order.cargo_weight_kg) == ('moving', None)


def test_an_update_without_load_type_keeps_the_saved_one(client, customer):
    order_id = _create(client, customer, {'load_type': 'vehicle'})

    entity = OrderEntity(order_id)
    entity.update(_update_payload())

    assert db.session.get(Order, order_id).load_type == 'vehicle'
    assert 'load_type' not in entity.written_fields


def _complete_belongings(order_id):
    order = db.session.get(Order, order_id)
    order.appointment_date = datetime(2026, 8, 20, 14, 0)
    order.comments = '200 sacos de arroz de 50 kg'
    db.session.commit()


def test_a_cargo_without_weight_is_not_ready_to_quote(client, customer):
    order_id = _create(client, customer, {'load_type': 'cargo'})
    _complete_belongings(order_id)

    assert BelongingsAppointmentDate(order_id).is_complete() is False
    assert _missing_fields_for_quotation(order_id) == ['cargo_weight_kg']


def test_a_cargo_with_weight_is_ready_to_quote(client, customer):
    order_id = _create(client, customer, {'load_type': 'cargo', 'cargo_weight_kg': 1500})
    _complete_belongings(order_id)

    assert BelongingsAppointmentDate(order_id).is_complete() is True
    assert _missing_fields_for_quotation(order_id) == []


@pytest.mark.parametrize('load_type', [None, 'moving', 'items', 'vehicle'])
def test_other_loads_need_no_weight(client, customer, load_type):
    order_id = _create(client, customer, {'load_type': load_type})
    _complete_belongings(order_id)

    assert BelongingsAppointmentDate(order_id).is_complete() is True


def test_the_order_details_carry_the_load(client, customer):
    order_id = _create(client, customer, {'load_type': 'cargo', 'cargo_weight_kg': 500})

    details = OrderEntity(order_id).details()

    assert (details['load_type'], details['cargo_weight_kg']) == ('cargo', 500)
