"""Con quién habla Chalán en cada empresa (migración 049).

La cuenta se crea a nombre del representante legal, pero por WhatsApp se habla
con quien coordina las mudanzas. Lo anota un admin, y el recordatorio a
transportistas lo lleva para saludarlo por su nombre.
"""
import pytest

from app import db
from tests.test_carrier_reminders import make_order, reminders
from tests.test_service_requests import make_user
from tests.test_services_per_company import catalog, make_company  # noqa: F401


@pytest.fixture
def superadmin(app):
    return make_user('superadmin')


def test_admin_writes_and_clears_the_coordinator(client, catalog, superadmin):
    company = make_company('Mudanzas SAC', 'moving')

    res = client.put(f'/api/carrier-companies/{company.id}', json={'coordinator_name': '  jackelinne   Ríos '},
                     headers=superadmin)
    assert res.get_json()['carrier_company']['coordinator_name'] == 'jackelinne Ríos'

    res = client.put(f'/api/carrier-companies/{company.id}', json={'coordinator_name': ''}, headers=superadmin)
    assert res.get_json()['carrier_company']['coordinator_name'] is None


@pytest.mark.parametrize('value', [123, 'x' * 61])
def test_a_coordinator_that_is_not_a_name_is_rejected(client, catalog, superadmin, value):
    company = make_company('Mudanzas SAC', 'moving')

    res = client.put(f'/api/carrier-companies/{company.id}', json={'coordinator_name': value}, headers=superadmin)

    assert res.status_code == 400


def test_admin_creates_a_company_with_its_coordinator(client, catalog, superadmin):
    res = client.post('/api/carrier-companies', json={'name': 'Nueva SAC', 'coordinator_name': 'Jackelinne'},
                      headers=superadmin)

    assert res.get_json()['carrier_company']['coordinator_name'] == 'Jackelinne'


def test_a_company_cannot_change_its_coordinator(client, catalog):
    company = make_company('Mudanzas SAC', 'moving')
    headers = make_user('carrier_company', carrier_company_id=company.id)

    res = client.put(f'/api/carrier-companies/{company.id}', json={'coordinator_name': 'Otra'}, headers=headers)

    assert res.status_code == 403
    assert db.session.get(type(company), company.id).coordinator_name is None


def test_the_reminder_names_the_coordinator(client, catalog, superadmin):
    company = make_company('Mudanzas SAC', 'moving')
    company.coordinator_name = 'Jackelinne Ríos'
    db.session.commit()
    make_order()

    assert reminders(client, superadmin)['Mudanzas SAC']['coordinator_name'] == 'Jackelinne Ríos'
