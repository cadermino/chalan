"""Datos de la tarjeta de identificación vehicular (migración 023).

Lo que se prueba es lo que deja datos malos sin que nadie lo note: kg escritos
en un campo de toneladas, una carrocería inventada, o un PUT parcial que borra
lo que ya estaba.
"""
import pytest

from app import db
from app.models import Vehicle
from tests.test_services_per_company import catalog, make_company, superadmin  # noqa: F401

CARD = {
    'category': 'n1', 'body_type': 'furgon', 'manufacture_year': 1992, 'color': 'Blanco',
    'passengers': 2, 'serial_number': 'KN2DAM881NK005822', 'registry_entry': '50077971',
    'gross_weight_tons': '3.490', 'net_weight_tons': '2.390', 'payload_tons': '1.100',
    'vehicle_length_m': '5.70', 'vehicle_width_m': '1.93', 'vehicle_height_m': '2.80',
}


@pytest.fixture
def company(catalog):  # noqa: F811
    return make_company('Mudanzas SAC', 'moving')


def vehicles_url(company):
    return f'/api/carrier-companies/{company.id}/vehicles'


def test_card_fields_are_saved_and_returned(client, company, superadmin):  # noqa: F811
    res = client.post(vehicles_url(company), json={'brand': 'Asia', **CARD}, headers=superadmin)

    assert res.status_code == 201
    vehicle = res.get_json()['vehicle']
    assert vehicle['category'] == 'N1'
    assert vehicle['payload_tons'] == 1.1
    assert vehicle['gross_weight_tons'] == 3.49
    assert vehicle['vehicle_length_m'] == 5.7
    assert vehicle['manufacture_year'] == 1992
    assert vehicle['box_length_m'] is None


@pytest.mark.parametrize('field, value', [
    ('payload_tons', '1100'),          # kg en un campo de toneladas
    ('vehicle_length_m', '570'),       # cm en un campo de metros
    ('payload_tons', '0'),
    ('payload_tons', 'dos'),
    ('body_type', 'camion'),
    ('manufacture_year', '92'),
    ('passengers', '1.5'),
    ('color', 'x' * 31),
])
def test_invalid_card_values_are_rejected(client, company, superadmin, field, value):  # noqa: F811
    res = client.post(vehicles_url(company), json={'brand': 'Asia', field: value}, headers=superadmin)

    assert res.status_code == 400
    assert Vehicle.query.count() == 0


def test_partial_update_keeps_other_card_fields_and_blank_clears(client, company, superadmin):  # noqa: F811
    created = client.post(vehicles_url(company), json={'brand': 'Asia', **CARD}, headers=superadmin)
    url = f"{vehicles_url(company)}/{created.get_json()['vehicle']['id']}"

    res = client.put(url, json={'payload_tons': '', 'color': 'Rojo'}, headers=superadmin)

    assert res.status_code == 200
    vehicle = res.get_json()['vehicle']
    assert vehicle['payload_tons'] is None
    assert vehicle['color'] == 'Rojo'
    assert vehicle['gross_weight_tons'] == 3.49
    assert vehicle['body_type'] == 'furgon'


def test_invalid_update_changes_nothing(client, company, superadmin):  # noqa: F811
    created = client.post(vehicles_url(company), json={'brand': 'Asia', **CARD}, headers=superadmin)
    url = f"{vehicles_url(company)}/{created.get_json()['vehicle']['id']}"

    res = client.put(url, json={'brand': 'Otra', 'payload_tons': '1100'}, headers=superadmin)

    assert res.status_code == 400
    db.session.expire_all()
    vehicle = db.session.get(Vehicle, created.get_json()['vehicle']['id'])
    assert vehicle.brand == 'Asia'
    assert float(vehicle.payload_tons) == 1.1
