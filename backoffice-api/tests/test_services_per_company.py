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


# --- lo que ve una empresa según lo que hace -----------------------------------

def company_user(company, suffix):
    return make_user('carrier_company', carrier_company_id=company.id, suffix=suffix)


def test_company_detail_lists_its_service_codes(client, catalog):
    company = make_company('Armadores SAC', 'furniture_assembly', 'packing')
    headers = company_user(company, 'detalle')

    res = client.get(f'/api/carrier-companies/{company.id}', headers=headers)

    assert res.status_code == 200
    codes = [t['code'] for t in res.get_json()['carrier_company']['service_types']]
    assert codes == ['packing', 'furniture_assembly']


def test_a_company_without_moving_cannot_see_moving_orders(client, catalog):
    company = make_company('Armadores SAC', 'furniture_assembly')
    headers = company_user(company, 'armador')
    order = Order(order_status_id=1)
    db.session.add(order)
    db.session.commit()

    assert client.get('/api/orders/pending', headers=headers).status_code == 403
    assert client.get('/api/orders/my-orders', headers=headers).status_code == 403
    assert client.get(f'/api/orders/{order.id}', headers=headers).status_code == 403


def test_a_company_that_does_moves_still_sees_its_orders(client, catalog):
    company = make_company('Mudanzas SAC', 'moving')
    headers = company_user(company, 'mudanzas')

    assert client.get('/api/orders/pending', headers=headers).status_code == 200
    assert client.get('/api/orders/my-orders', headers=headers).status_code == 200


def test_dashboard_of_a_company_without_moving_says_what_it_does(client, catalog):
    company = make_company('Armadores SAC', 'furniture_assembly')
    headers = company_user(company, 'dash')

    body = client.get('/api/dashboard', headers=headers).get_json()

    assert body['role'] == 'carrier'
    assert body['does_moves'] is False
    assert body['services'] == ['Armado y desarmado de muebles']
    assert 'opportunities' not in body


def test_dashboard_of_a_company_that_does_moves_is_unchanged(client, catalog, monkeypatch):
    # Dos cosas del dashboard de mudanzas no corren en SQLite: el rendimiento usa
    # percentile_cont (Postgres) y las reseñas leen `reviews`, tabla del API
    # principal sin modelo acá. Lo que se prueba es que siga saliendo completo.
    monkeypatch.setattr('app.api.dashboard._carrier_performance', lambda *args: {})
    db.session.execute(db.text(
        'CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY, carrier_company_id INTEGER, rating INTEGER)'))
    db.session.commit()
    company = make_company('Mudanzas SAC', 'moving')
    headers = company_user(company, 'dash-mov')

    body = client.get('/api/dashboard', headers=headers).get_json()

    assert body['does_moves'] is True
    assert 'opportunities' in body


# --- vehículos: solo para quien hace mudanzas -----------------------------------

def test_a_company_without_moving_cannot_get_new_vehicles(client, catalog, superadmin):
    company = make_company('Armadores SAC', 'furniture_assembly')

    res = client.post(f'/api/carrier-companies/{company.id}/vehicles', json={'brand': 'Hyundai'},
                      headers=superadmin)

    assert res.status_code == 409


def test_a_company_that_does_moves_can_add_vehicles(client, catalog, superadmin):
    company = make_company('Mudanzas SAC', 'moving')

    res = client.post(f'/api/carrier-companies/{company.id}/vehicles', json={'brand': 'Hyundai'},
                      headers=superadmin)

    assert res.status_code == 201
