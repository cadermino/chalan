"""Dónde trabaja cada empresa, por departamento (migración 037).

Lo que se prueba es lo que fallaría en silencio cuando las órdenes se repartan
por departamento: que las empresas nuevas nazcan en Lima, que Callao no se
guarde aparte de Lima y que una empresa no pueda cambiar dónde trabaja.
"""
import pytest

from app import db
from app.models import CarrierCompany, CarrierCompanyDepartment
from tests.test_service_requests import make_user
from tests.test_services_per_company import COMPANY_FIELDS, catalog, make_company  # noqa: F401


@pytest.fixture
def superadmin(app):
    return make_user('superadmin')


def test_self_registered_company_is_born_in_lima(client, catalog, monkeypatch):
    monkeypatch.setenv('COUNTRY_ID', '2')
    res = client.post('/auth/register', json={
        'first_name': 'Juan', 'last_name': 'Perez', 'dni': '12345678', 'email': 'juan@example.com',
        'password': 'testpass123', 'phone': '+51987654321', 'role': 'carrier_company',
    })

    assert res.status_code == 201
    company = CarrierCompany.query.filter_by(email='juan@example.com').one()
    assert company.department_codes == ['15']


def test_admin_created_company_without_departments_is_in_lima(client, catalog, superadmin):
    res = client.post('/api/carrier-companies', json={**COMPANY_FIELDS, 'name': 'Mudanzas SAC'},
                      headers=superadmin)

    assert res.status_code == 201
    body = res.get_json()['carrier_company']
    assert body['department_codes'] == ['15']
    assert body['departments'] == [{'code': '15', 'name': 'Lima y Callao'}]


def test_admin_created_company_keeps_the_departments_it_is_given(client, catalog, superadmin):
    res = client.post('/api/carrier-companies', json={
        **COMPANY_FIELDS, 'name': 'Mudanzas Arequipa', 'department_codes': ['04', '18', '04'],
    }, headers=superadmin)

    assert res.status_code == 201
    assert res.get_json()['carrier_company']['department_codes'] == ['04', '18']


@pytest.mark.parametrize('codes', [['07'], ['99'], [4], '04'])
def test_unknown_departments_are_rejected(client, catalog, superadmin, codes):
    company = make_company('Mudanzas SAC', 'moving')

    res = client.put(f'/api/carrier-companies/{company.id}', json={'department_codes': codes},
                     headers=superadmin)

    assert res.status_code == 400
    assert CarrierCompanyDepartment.query.count() == 0


def test_admin_replaces_where_a_company_works(client, catalog, superadmin):
    company = make_company('Mudanzas SAC', 'moving')
    db.session.add(CarrierCompanyDepartment(carrier_company_id=company.id, department_code='15'))
    db.session.commit()

    res = client.put(f'/api/carrier-companies/{company.id}', json={'department_codes': ['15', '04']},
                     headers=superadmin)
    assert res.status_code == 200
    assert res.get_json()['carrier_company']['department_codes'] == ['04', '15']

    res = client.put(f'/api/carrier-companies/{company.id}', json={'department_codes': ['04']},
                     headers=superadmin)
    assert res.get_json()['carrier_company']['department_codes'] == ['04']
    assert [d.department_code for d in CarrierCompanyDepartment.query.all()] == ['04']


def test_a_company_cannot_change_where_it_works(client, catalog):
    company = make_company('Mudanzas SAC', 'moving')
    headers = make_user('carrier_company', carrier_company_id=company.id)

    res = client.put(f'/api/carrier-companies/{company.id}', json={'department_codes': ['04']},
                     headers=headers)

    assert res.status_code == 403
    assert CarrierCompanyDepartment.query.count() == 0


def test_list_shows_the_departments_of_each_company(client, catalog, superadmin):
    lima = make_company('Lima SAC', 'moving')
    arequipa = make_company('Arequipa SAC', 'moving')
    make_company('Sin departamento', 'moving')
    db.session.add_all([
        CarrierCompanyDepartment(carrier_company_id=lima.id, department_code='15'),
        CarrierCompanyDepartment(carrier_company_id=arequipa.id, department_code='04'),
    ])
    db.session.commit()

    res = client.get('/api/carrier-companies', headers=superadmin)

    by_name = {c['name']: c for c in res.get_json()['carrier_companies']}
    assert by_name['Lima SAC']['departments'] == [{'code': '15', 'name': 'Lima y Callao'}]
    assert by_name['Arequipa SAC']['department_codes'] == ['04']
    assert by_name['Sin departamento']['department_codes'] == []


def test_departments_catalog_puts_lima_first_and_leaves_callao_out(client, superadmin):
    res = client.get('/api/departments', headers=superadmin)

    departments = res.get_json()['departments']
    assert departments[0] == {'code': '15', 'name': 'Lima y Callao'}
    assert departments[1] == {'code': '01', 'name': 'Amazonas'}
    assert len(departments) == 24
    assert '07' not in [d['code'] for d in departments]
