import os

import pytest

from app import db
from app.models import CarrierCompany


@pytest.fixture(autouse=True)
def _country_id_env():
    original = os.environ.get('COUNTRY_ID')
    os.environ['COUNTRY_ID'] = '2'
    yield
    if original is not None:
        os.environ['COUNTRY_ID'] = original
    else:
        os.environ.pop('COUNTRY_ID', None)


def _register_payload(**overrides):
    payload = {
        'first_name': 'Juan',
        'last_name': 'Perez',
        'dni': '12345678',
        'email': 'juan@example.com',
        'password': 'testpass123',
        'phone': '+51987654321',
        'role': 'carrier_company',
    }
    payload.update(overrides)
    return payload


def test_carrier_self_registration_sets_country_id_from_env(client):
    res = client.post('/auth/register', json=_register_payload())

    assert res.status_code == 201
    company = db.session.query(CarrierCompany).filter_by(email='juan@example.com').first()
    assert company is not None
    assert company.country_id == 2


def test_carrier_self_registration_is_excluded_from_notifications_without_country_id(client, monkeypatch):
    # get_carrier_companies() (app/api/orders.py, main app) filters strictly by
    # country_id == COUNTRY_ID — a carrier with country_id=None never gets
    # notified of new orders, no matter how "active" it is. Simulate the old,
    # broken behavior (COUNTRY_ID unset at registration time) to prove the
    # regression this test guards against would otherwise be silent.
    monkeypatch.delenv('COUNTRY_ID', raising=False)

    res = client.post('/auth/register', json=_register_payload(email='broken@example.com'))

    assert res.status_code == 201
    company = db.session.query(CarrierCompany).filter_by(email='broken@example.com').first()
    assert company.country_id is None  # documents the failure mode when COUNTRY_ID is missing


def test_carrier_registration_requires_phone(client):
    payload = _register_payload()
    del payload['phone']

    res = client.post('/auth/register', json=payload)

    assert res.status_code == 400
    assert 'phone' in res.get_json()['message']
