"""Transportistas de Google Maps para las órdenes que no son de Lima.

Se prueba la ubicación de una dirección (código postal, texto, coordenadas), lo
que pide la orden, el orden de los resultados y el endpoint del backoffice. Los
transportistas son una lista armada aquí, no el JSON real, salvo un chequeo de
que ese JSON tiene la forma que el código espera.
"""
from datetime import datetime
from types import SimpleNamespace

import pytest

from app import carrier_prospects as cp
from app import db
from app.models import Order, OrderDetail
from tests.test_service_requests import admin, make_user  # noqa: F401


def address(**fields):
    base = dict(street=None, zip_code=None, city=None, state=None, latitude=None, longitude=None)
    return SimpleNamespace(**{**base, **fields})


# --- ubicar una dirección --------------------------------------------------------

def test_postal_code_gives_the_department():
    loc = cp.locate(address(zip_code='04003'))
    assert (loc['code'], loc['department'], loc['lima'], loc['source']) == ('04', 'Arequipa', False, 'postal')


def test_postal_code_is_read_from_the_end_of_the_google_address():
    loc = cp.locate(address(street='Jiron Leoncio Prado 420, Arequipa 04003, Perú'))
    assert loc['department'] == 'Arequipa' and loc['source'] == 'postal'


def test_a_five_digit_street_number_is_not_a_postal_code():
    # "12345" es la numeración de la calle: sin código postal se cae al texto.
    loc = cp.locate(address(street='Av. Arequipa 12345, Chiclayo, Perú'))
    assert loc['department'] == 'Lambayeque' and loc['source'] == 'text'


def test_lima_and_callao_are_both_lima():
    assert cp.locate(address(zip_code='15074'))['lima'] is True
    assert cp.locate(address(zip_code='07001'))['lima'] is True


def test_city_and_state_are_used_when_there_is_no_postal_code():
    loc = cp.locate(address(city='Trujillo', state='La Libertad'))
    assert loc['code'] == '13' and loc['source'] == 'text'


def test_a_lima_district_without_postal_code_is_lima():
    assert cp.locate(address(street='Av. Larco 1301, Miraflores, Perú'))['lima'] is True


def test_an_unknown_address_is_none():
    assert cp.locate(address(street='Calle sin nombre')) is None
    assert cp.locate(None) is None


def test_coordinates_are_kept():
    loc = cp.locate(address(zip_code='04003', latitude=-16.4, longitude=-71.5))
    assert (loc['lat'], loc['lng']) == (-16.4, -71.5)


# --- qué pide la orden -----------------------------------------------------------

@pytest.mark.parametrize('text,expected', [
    ('Necesito llevar una camioneta Hilux', ['vehiculos']),
    ('2 motos y una cama', ['vehiculos']),
    ('20 bolsas de cemento y fierros', ['construccion']),
    ('Una camioneta y material de construccion', ['vehiculos', 'construccion']),
    ('flete de mercaderia', ['carga']),
    ('1 cama matrimonial\n1 sofá 3 cuerpos', ['mudanza']),
    ('', ['mudanza']),
    (None, ['mudanza']),
])
def test_detect_needs(text, expected):
    assert cp.detect_needs(text) == expected


def test_words_inside_other_words_do_not_count():
    # "automatico" y "motor" no son un auto ni una moto.
    assert cp.detect_needs('lavadora automatico con motor') == ['mudanza']


# --- elegir y ordenar ------------------------------------------------------------

def prospect(pid, department='04', type_='carga', name='Transportes', category='Empresa de transporte',
             lat=None, lng=None, score=None, reviews=0):
    return {'id': pid, 'name': name, 'city': 'arequipa', 'department': department, 'type': type_,
            'category': category, 'address': 'x', 'lat': lat, 'lng': lng, 'phone': '+51999111222',
            'rating': 4.5, 'reviews': reviews, 'score': score, 'maps_url': None}


AREQUIPA = {'code': '04', 'department': 'Arequipa', 'lima': False, 'source': 'postal', 'lat': None, 'lng': None}


def test_only_the_department_of_the_order_is_listed():
    rows = cp.match(AREQUIPA, 'carga', [prospect('a'), prospect('b', department='13')])
    assert [r['id'] for r in rows] == ['a']


def test_exact_type_comes_before_related_ones():
    prospects = [prospect('mud', type_='mudanza', score=4.9), prospect('car', type_='carga', score=3.0)]
    rows = cp.match(AREQUIPA, 'carga', prospects)
    assert [r['id'] for r in rows] == ['car', 'mud']
    assert [r['exact'] for r in rows] == [True, False]


def test_vehicles_need_only_tow_trucks_and_the_like():
    prospects = [
        prospect('grua', type_='vehiculos', name='Grúas Sur'),
        prospect('plat', type_='carga', name='Plataformas del Sur'),
        prospect('mud', type_='mudanza', name='Mudanzas Arequipa'),
    ]
    rows = cp.match(AREQUIPA, 'vehiculos', prospects)
    assert [r['id'] for r in rows] == ['grua', 'plat']


def test_all_does_not_filter_by_type():
    prospects = [prospect('a', type_='mudanza'), prospect('b', type_='vehiculos'), prospect('c', type_='')]
    assert {r['id'] for r in cp.match(AREQUIPA, 'todos', prospects)} == {'a', 'b', 'c'}


def test_score_orders_the_list_when_the_order_has_no_coordinates():
    prospects = [prospect('low', score=3.1), prospect('high', score=4.8), prospect('none')]
    assert [r['id'] for r in cp.match(AREQUIPA, 'carga', prospects)] == ['high', 'low', 'none']


def test_distance_orders_the_list_when_the_order_has_coordinates():
    here = {**AREQUIPA, 'lat': -16.40, 'lng': -71.53}
    prospects = [
        prospect('far', lat=-16.30, lng=-71.40, score=4.9),
        prospect('near', lat=-16.401, lng=-71.531, score=3.0),
    ]
    rows = cp.match(here, 'carga', prospects)
    assert [r['id'] for r in rows] == ['near', 'far']
    assert rows[0]['distance_km'] < 1 < rows[1]['distance_km']


def test_counts_per_need():
    prospects = [prospect('a', type_='carga'), prospect('b', type_='mudanza'),
                 prospect('c', type_='vehiculos'), prospect('d', department='13')]
    counts = cp.count_by_need(AREQUIPA, prospects)
    assert counts['todos'] == 3
    assert counts['vehiculos'] == 1
    assert counts['carga'] == 2  # la de carga y la de mudanza, de apoyo


# --- el JSON que se genera -------------------------------------------------------

def test_the_generated_json_has_the_shape_the_code_expects():
    prospects = cp.load_prospects()
    assert prospects, 'falta correr scripts/build_carrier_prospects.py'
    for p in prospects:
        assert p['department'] in cp.DEPARTMENTS
        assert p['phone'].startswith('+51')
        assert p['name']
        assert p['type'] in ('', 'mudanza', 'vehiculos', 'carga')


# --- endpoint --------------------------------------------------------------------

@pytest.fixture
def prospects(monkeypatch):
    rows = [
        prospect('grua', type_='vehiculos', name='Grúas Sur', score=4.0),
        prospect('car', type_='carga', score=4.5),
        prospect('mud', type_='mudanza', score=4.9),
        prospect('trujillo', department='13', type_='carga'),
    ]
    monkeypatch.setattr(cp, 'load_prospects', lambda: tuple(rows))


def make_order(origin, destination=None, comments=None):
    order = Order(order_status_id=1, created_date=datetime(2026, 10, 20), comments=comments)
    db.session.add(order)
    db.session.commit()
    for kind, fields in (('carry_from', origin), ('deliver_to', destination)):
        if fields is not None:
            db.session.add(OrderDetail(order_id=order.id, type=kind, **fields))
    db.session.commit()
    return order


def nearby(client, headers, order, **query):
    return client.get(f'/api/orders/{order.id}/nearby-carriers', headers=headers, query_string=query)


def test_an_order_outside_lima_lists_the_carriers_of_its_department(client, admin, prospects):
    order = make_order({'street': 'Calle 1, Arequipa 04003, Perú', 'zip_code': '04003'},
                       comments='Una camioneta Hilux')

    res = nearby(client, admin, order)

    assert res.status_code == 200
    body = res.get_json()
    assert body['applicable'] is True
    assert body['location']['department'] == 'Arequipa'
    assert body['need'] == 'vehiculos' and body['detected'] == ['vehiculos']
    assert [c['id'] for c in body['carriers']] == ['grua']
    assert body['counts']['todos'] == 3


def test_need_can_be_overridden(client, admin, prospects):
    order = make_order({'zip_code': '04003'}, comments='Una camioneta Hilux')

    body = nearby(client, admin, order, need='carga').get_json()

    assert body['need'] == 'carga'
    assert [c['id'] for c in body['carriers']] == ['car', 'mud']
    assert [c['id'] for c in nearby(client, admin, order, need='todos').get_json()['carriers']] == ['mud', 'car', 'grua']


def test_an_unknown_need_falls_back_to_the_detected_one(client, admin, prospects):
    order = make_order({'zip_code': '04003'}, comments='20 bolsas de cemento')
    assert nearby(client, admin, order, need='hackeado').get_json()['need'] == 'construccion'


def test_a_lima_order_has_nothing_to_show(client, admin, prospects):
    order = make_order({'zip_code': '15074'}, {'zip_code': '15036'})

    body = nearby(client, admin, order).get_json()

    assert body['applicable'] is False and body['reason'] == 'lima'


def test_an_order_with_unlocatable_addresses_says_so(client, admin, prospects):
    order = make_order({'street': 'Calle sin nombre'})
    assert nearby(client, admin, order).get_json()['reason'] == 'unknown'


def test_a_move_from_lima_to_the_provinces_uses_the_destination(client, admin, prospects):
    order = make_order({'zip_code': '15074'}, {'zip_code': '13001'})

    body = nearby(client, admin, order).get_json()

    assert body['applicable'] is True and body['end'] == 'destination'
    assert body['location']['department'] == 'La Libertad'
    assert [c['id'] for c in body['carriers']] == ['trujillo']


def test_both_ends_outside_lima_can_be_chosen(client, admin, prospects):
    order = make_order({'zip_code': '04003'}, {'zip_code': '13001'})

    assert nearby(client, admin, order).get_json()['end'] == 'origin'
    body = nearby(client, admin, order, end='destination').get_json()
    assert body['end'] == 'destination' and body['location']['department'] == 'La Libertad'
    assert nearby(client, admin, order, end='nope').get_json()['end'] == 'origin'


def test_only_admins_see_it(client, prospects):
    order = make_order({'zip_code': '04003'})
    assert nearby(client, make_user('carrier_company', suffix='c'), order).status_code == 403
    assert nearby(client, make_user('real_estate_agent', suffix='r'), order).status_code == 403
    assert client.get(f'/api/orders/{order.id}/nearby-carriers').status_code == 401


def test_a_missing_order_is_404(client, admin, prospects):
    assert client.get('/api/orders/9999/nearby-carriers', headers=admin).status_code == 404
