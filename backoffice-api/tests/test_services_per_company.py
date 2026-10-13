"""La mudanza como un servicio más de cada empresa (migración 022).

Lo que se prueba es lo que, si se rompe, falla en silencio: que las empresas
nuevas nazcan con la mudanza (si no, no reciben ninguna orden y nada lo avisa),
y que una empresa sin la mudanza no aparezca donde se reparten mudanzas.
"""
import pytest

from app import db
from app.models import CarrierCompany, CarrierCompanyServiceType, Order, ServiceType
from tests.test_service_requests import make_user

COMPANY_FIELDS = {'description': '', 'rfc': '', 'email': '', 'phone': '', 'address': '',
                  'cover_image': '', 'facebook': '', 'youtube': '', 'country_id': 2}


@pytest.fixture
def catalog(app):
    types = {
        'moving': ServiceType(code='moving', name='Mudanzas y fletes'),
        'packing': ServiceType(code='packing', name='Embalaje', requestable=1),
        'furniture_assembly': ServiceType(code='furniture_assembly', name='Armado y desarmado de muebles'),
    }
    db.session.add_all(types.values())
    db.session.commit()
    return types


@pytest.fixture
def superadmin(app):
    return make_user('superadmin')


def make_company(name, *codes, active=1):
    company = CarrierCompany(name=name, active=active, rfc='', country_id=2)
    db.session.add(company)
    db.session.commit()
    for code in codes:
        service_type = ServiceType.query.filter_by(code=code).one()
        db.session.add(CarrierCompanyServiceType(carrier_company_id=company.id,
                                                 service_type_id=service_type.id))
    db.session.commit()
    return company


def test_self_registered_company_is_born_with_moving(client, catalog, monkeypatch):
    monkeypatch.setenv('COUNTRY_ID', '2')
    res = client.post('/auth/register', json={
        'first_name': 'Juan', 'last_name': 'Perez', 'dni': '12345678', 'email': 'juan@example.com',
        'password': 'testpass123', 'phone': '+51987654321', 'role': 'carrier_company',
    })

    assert res.status_code == 201
    company = CarrierCompany.query.filter_by(email='juan@example.com').one()
    assert [t.code for t in company.service_types] == ['moving']


def test_admin_created_company_without_services_gets_moving(client, catalog, superadmin):
    res = client.post('/api/carrier-companies', json={**COMPANY_FIELDS, 'name': 'Mudanzas SAC'},
                      headers=superadmin)

    assert res.status_code == 201
    assert res.get_json()['carrier_company']['service_type_ids'] == [catalog['moving'].id]


def test_admin_created_company_keeps_the_services_it_is_given(client, catalog, superadmin):
    res = client.post('/api/carrier-companies', json={
        **COMPANY_FIELDS, 'name': 'Armadores SAC',
        'service_type_ids': [catalog['furniture_assembly'].id],
    }, headers=superadmin)

    assert res.status_code == 201
    assert res.get_json()['carrier_company']['service_type_ids'] == [catalog['furniture_assembly'].id]


def test_doing_moves_needs_the_moving_service_and_an_active_company(app, catalog):
    movers = make_company('Mudanzas SAC', 'moving', 'packing')
    make_company('Solo Embala', 'packing')
    make_company('Armadores SAC', 'furniture_assembly')
    make_company('Inactiva', 'moving', active=0)

    assert [c.id for c in CarrierCompany.doing_moves().all()] == [movers.id]


def test_quotation_links_only_list_companies_that_do_moves(client, catalog, superadmin):
    movers = make_company('Mudanzas SAC', 'moving')
    make_company('Armadores SAC', 'furniture_assembly')
    order = Order(order_status_id=1)
    db.session.add(order)
    db.session.commit()

    res = client.get(f'/api/orders/{order.id}/quotation-links', headers=superadmin)

    assert res.status_code == 200
    body = res.get_json()
    companies = next(v for v in body.values() if isinstance(v, list)) if isinstance(body, dict) else body
    assert [c['id'] for c in companies] == [movers.id]


def test_service_types_say_which_ones_are_requestable(client, catalog, superadmin):
    res = client.get('/api/service-types', headers=superadmin)

    requestable = {t['code']: t['requestable'] for t in res.get_json()['service_types']}
    assert requestable == {'moving': False, 'packing': True, 'furniture_assembly': False}
