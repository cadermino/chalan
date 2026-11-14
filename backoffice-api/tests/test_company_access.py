"""Quién ve y edita una empresa.

Solo se restringía al rol de empresa: un agente inmobiliario pasaba como admin y
veía teléfono, correo y RUC de todas, sus vehículos y tarifas, y podía editarlas.
"""
import pytest

from tests.test_service_requests import make_user
from tests.test_services_per_company import catalog, make_company  # noqa: F401


@pytest.fixture
def agent(app):
    return make_user('real_estate_agent')


def test_an_agent_cannot_see_or_edit_the_companies(client, catalog, agent):
    company = make_company('Mudanzas SAC', 'moving')
    base = f'/api/carrier-companies/{company.id}'

    assert client.get('/api/carrier-companies', headers=agent).status_code == 403
    assert client.get(base, headers=agent).status_code == 403
    assert client.put(base, json={'phone': '999999999'}, headers=agent).status_code == 403
    assert client.get(f'{base}/vehicles', headers=agent).status_code == 403
    assert client.post(f'{base}/vehicles', json={}, headers=agent).status_code == 403
    assert client.get(f'{base}/rates', headers=agent).status_code == 403


def test_a_company_sees_only_its_own(client, catalog):
    own = make_company('Mudanzas SAC', 'moving')
    other = make_company('Fletes EIRL', 'moving')
    headers = make_user('carrier_company', carrier_company_id=own.id)

    listed = client.get('/api/carrier-companies', headers=headers).get_json()['carrier_companies']
    assert [c['id'] for c in listed] == [own.id]
    assert client.get(f'/api/carrier-companies/{own.id}', headers=headers).status_code == 200
    assert client.get(f'/api/carrier-companies/{other.id}', headers=headers).status_code == 403


def test_admins_still_see_every_company(client, catalog):
    make_company('Mudanzas SAC', 'moving')
    make_company('Fletes EIRL', 'moving')

    for role in ('admin', 'superadmin'):
        headers = make_user(role)
        res = client.get('/api/carrier-companies', headers=headers)
        assert len(res.get_json()['carrier_companies']) == 2, role
