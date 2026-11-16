"""El historial de cambios de una orden (migración 051, api/order/versions.py).

Desde que la orden sale a transportistas, cada cambio deja una foto entera de
lo que ellos leen, y el diff entre dos fotos se arma al leer.
"""
from datetime import datetime, timedelta

import pytest

from app import db
from app.api.carrier_company import CarrierCompany as CarrierCompanyEntity
from app.api.decorators import generate_internal_token
from app.api.order import versions
from app.api.order.versions import backfill, diff_snapshots, history_for_admin, record_version
from app.api.orders import send_email_to_carrier_companies
from app.api.quotation.quotation_status import QuotationStatus
from app.models import (AdminUser, CarrierCompany, CarrierCompanyServiceType, LuServices, Order,
                        OrderImage, OrdersServices, OrderVersion, Quotations, ReferredOrder, ServiceType)

ORIGIN = {
    'from_street': 'Av. Javier Prado 123, San Isidro 15036, Perú',
    'from_floor_number': 3,
    'from_country': 'Peru',
    'from_map_url': 'https://maps.google.com/x',
}
DESTINATION = {
    'to_street': 'Calle Mercaderes 456, Lince 15046, Perú',
    'to_floor_number': 1,
    'to_country': 'Peru',
    'to_map_url': 'https://maps.google.com/y',
}


@pytest.fixture(autouse=True)
def quiet(monkeypatch):
    for module in ('app.api.orders', 'app.api.quotations'):
        monkeypatch.setattr(f'{module}.send_email', lambda *a, **kw: None)
        monkeypatch.setattr(f'{module}.send_whatsapp', lambda *a, **kw: None)


@pytest.fixture(autouse=True)
def _seed(app, carrier_company, monkeypatch):
    db.session.add_all([
        LuServices(service='cargo', description='Carga y descarga'),
        LuServices(service='packaging', description='Embalaje'),
    ])
    monkeypatch.setenv('COUNTRY_ID', '2')
    carrier_company.country_id = 2
    carrier_company.email = 'carrier@example.com'
    moving = ServiceType(code='moving', name='Mudanzas y fletes')
    db.session.add(moving)
    db.session.commit()
    db.session.add(CarrierCompanyServiceType(carrier_company_id=carrier_company.id,
                                             service_type_id=moving.id))
    db.session.commit()


def _auth(customer):
    return {'Authorization': f'Bearer {customer.generate_auth_token(3600)}'}


def _internal():
    return {'Authorization': f'Bearer {generate_internal_token()}'}


def _create_order(client, customer):
    res = client.post('/api/v1/order', json={
        'customer': {'customer_id': customer.id},
        'orderDetailsOrigin': ORIGIN,
        'orderDetailsDestination': DESTINATION,
    }, headers=_auth(customer))
    order_id = res.get_json()['order_id']
    # Fecha, cosas y servicios por el ORM: la ruta escribe la fecha como texto
    # crudo, que Postgres convierte y el SQLite de las pruebas rechaza.
    order = db.session.get(Order, order_id)
    order.appointment_date = datetime(2026, 8, 20, 14, 0)
    order.comments = '1 sofa\n3 cajas'
    order.approximate_budget = 500
    cargo = LuServices.query.filter_by(service='cargo').first()
    db.session.add(OrdersServices(order_id=order_id, service_id=cargo.id))
    db.session.commit()
    return order_id


def _sent_order(client, customer):
    order_id = _create_order(client, customer)
    assert send_email_to_carrier_companies(order_id, {'requestQuotationFromCarrierCompany': True})
    return order_id


def _edit(client, customer, order_id, comments='1 sofa\n3 cajas', origin=None, flag=True):
    """El PUT de los pasos 1 y 2. La fecha va en None por lo mismo que arriba,
    así que cambiarla por aquí siempre cuenta como cambio de fecha."""
    payload = {
        'customer': {'customer_id': None},
        'order': {'appointment_date': None, 'comments': comments, 'approximate_budget': 500},
        'orderDetailsOrigin': {**ORIGIN, **(origin or {})},
        'orderDetailsDestination': DESTINATION,
        'services': {'cargo': '1', 'packaging': '0'},
    }
    if flag:
        payload['orderEditedByCustomer'] = True
    res = client.put(f'/api/v1/order/{order_id}', json=payload, headers=_auth(customer))
    assert res.status_code == 200
    return res


def _versions(order_id):
    return OrderVersion.query.filter_by(order_id=order_id).order_by(OrderVersion.number).all()


def _fields(entries):
    return [e['field'] for e in entries]


def test_an_order_that_never_went_out_has_no_versions(client, customer):
    order_id = _create_order(client, customer)

    _edit(client, customer, order_id, comments='1 sofa\n4 cajas')

    assert _versions(order_id) == []


def test_the_first_notice_is_version_1(client, customer):
    order_id = _sent_order(client, customer)

    [v1] = _versions(order_id)
    assert v1.number == 1
    assert v1.notified_at is not None
    assert v1.author == 'customer'
    assert v1.snapshot['comments'] == '1 sofa\n3 cajas'
    assert v1.snapshot['services'] == ['cargo']
    assert v1.snapshot['origin']['street'] == ORIGIN['from_street']


def test_a_customer_edit_after_the_notice_is_a_new_version(client, customer):
    order_id = _sent_order(client, customer)

    _edit(client, customer, order_id, comments='1 sofa\n3 cajas\n1 refrigeradora')

    v1, v2 = _versions(order_id)
    assert v2.number == 2 and v2.author == 'customer' and v2.notified_at is None
    entries = diff_snapshots(v1.snapshot, v2.snapshot)
    assert _fields(entries) == ['appointment_date', 'comments']
    [items] = [e for e in entries if e['field'] == 'comments']
    assert items['lines'] == [{'op': '=', 'text': '1 sofa'}, {'op': '=', 'text': '3 cajas'},
                              {'op': '+', 'text': '1 refrigeradora'}]


def test_the_same_edit_twice_is_one_version(client, customer):
    order_id = _sent_order(client, customer)

    _edit(client, customer, order_id, comments='1 sofa\n2 cajas')
    _edit(client, customer, order_id, comments='  1 sofa \n\n2 cajas\n')

    assert [v.number for v in _versions(order_id)] == [1, 2]


def test_a_put_without_the_edit_flag_is_no_version(client, customer):
    # Login, registro y el modal de pago reenvían el localStorage: no escriben nada.
    order_id = _sent_order(client, customer)

    _edit(client, customer, order_id, comments='otra cosa', flag=False)

    assert [v.number for v in _versions(order_id)] == [1]


def test_a_change_the_old_check_does_not_see_is_still_a_version(client, customer):
    # has_changed no mira el ascensor; el historial sí.
    order_id = _sent_order(client, customer)
    _edit(client, customer, order_id)

    _edit(client, customer, order_id, origin={'from_has_elevator': 1})

    v2, v3 = _versions(order_id)[1:]
    [entry] = diff_snapshots(v2.snapshot, v3.snapshot)
    assert entry == {'field': 'origin.has_elevator', 'label': 'Ascensor (origen)', 'kind': 'value',
                     'before': 'No', 'after': 'Sí'}


def test_the_texts_of_the_diff(client, customer):
    order_id = _sent_order(client, customer)
    order = db.session.get(Order, order_id)
    order.appointment_date = datetime(2026, 8, 22, 9, 0)
    order.comments = '1 sofa\n1 cama king'
    order.approximate_budget = 650
    order.load_type = 'items'
    packaging = LuServices.query.filter_by(service='packaging').first()
    OrdersServices.query.filter_by(order_id=order_id).delete()
    db.session.add(OrdersServices(order_id=order_id, service_id=packaging.id))
    destination = order.order_details.filter_by(type='deliver_to').first()
    destination.street = 'Jr. Huiracocha 2050, Jesús María 15072, Perú'
    destination.approximate_distance_from_parking = 50
    origin = order.order_details.filter_by(type='carry_from').first()
    origin.map_url = 'https://maps.google.com/otro'
    db.session.add(OrderImage(order_id=order_id, url='https://x/a.jpg', storage_key='orders/a.jpg'))
    db.session.commit()

    record_version(order_id, 'customer')

    v1, v2 = _versions(order_id)
    entries = {e['field']: e for e in diff_snapshots(v1.snapshot, v2.snapshot)}
    assert entries['appointment_date']['before'] == 'jue 20 ago, 2:00 pm'
    assert entries['appointment_date']['after'] == 'sáb 22 ago, 9:00 am'
    assert (entries['load_type']['before'], entries['load_type']['after']) == ('Mudanza', 'Objetos sueltos')
    assert entries['comments']['lines'] == [{'op': '=', 'text': '1 sofa'}, {'op': '-', 'text': '3 cajas'},
                                            {'op': '+', 'text': '1 cama king'}]
    assert (entries['approximate_budget']['before'], entries['approximate_budget']['after']) == ('S/ 500', 'S/ 650')
    assert entries['services']['added'] == ['Embalaje']
    assert entries['services']['removed'] == ['Carga y descarga']
    assert entries['destination.street']['label'] == 'Destino'
    assert entries['destination.street']['after'] == 'Jr. Huiracocha 2050, Jesús María 15072, Perú'
    assert entries['destination.approximate_distance_from_parking']['after'] == 'Entre 20 y 50 m'
    assert entries['origin.location'] == {'field': 'origin.location', 'label': 'Origen: punto en el mapa',
                                          'kind': 'value', 'before': None,
                                          'after': 'Se movió el punto en el mapa'}
    assert (entries['images']['before'], entries['images']['after']) == ('Sin fotos', '1 foto')


def test_a_new_notice_marks_the_current_version_without_making_another(client, customer):
    # Por el ORM y no por _edit: ese PUT deja la fecha vacía, y sin fecha la
    # orden no se manda.
    order_id = _sent_order(client, customer)
    order = db.session.get(Order, order_id)
    order.comments = '1 sofa'
    db.session.commit()
    record_version(order_id, 'customer')
    order.quotation_requested = False
    db.session.commit()

    assert send_email_to_carrier_companies(order_id, {'requestQuotationFromCarrierCompany': True})

    v1, v2 = _versions(order_id)
    assert v2.notified_at is not None


def _quote(client, order_id, company):
    token = CarrierCompanyEntity().generate_carrier_company_token(3600, order_id, company.id)
    return client.post('/api/v1/quotations', json={'amount': 400},
                       headers={'Authorization': f'Bearer {token}'})


def test_a_quotation_keeps_the_version_it_was_made_on(client, customer, carrier_company):
    order_id = _sent_order(client, customer)

    assert _quote(client, order_id, carrier_company).status_code == 201
    v1 = _versions(order_id)[0]
    assert Quotations.query.one().order_version_id == v1.id

    _edit(client, customer, order_id, comments='1 sofa')
    assert _quote(client, order_id, carrier_company).status_code == 200
    v2 = _versions(order_id)[1]
    assert Quotations.query.one().order_version_id == v2.id


def test_the_admin_history(client, customer, carrier_company):
    order_id = _sent_order(client, customer)
    _quote(client, order_id, carrier_company)
    _edit(client, customer, order_id, comments='1 sofa')

    history = history_for_admin(order_id)

    assert history['current_number'] == 2
    assert [v['number'] for v in history['versions']] == [1, 2]
    assert history['versions'][0]['entries'] == []
    assert 'comments' in _fields(history['versions'][1]['entries'])
    [quotation] = history['quotations']
    assert quotation['carrier_company_name'] == carrier_company.name
    assert quotation['version_number'] == 1


def test_the_backoffice_records_its_edits_with_who_made_them(client, customer):
    order_id = _sent_order(client, customer)
    db.session.get(Order, order_id).comments = '2 sofas'
    db.session.commit()

    res = client.post(f'/api/v1/order/{order_id}/versions', json={'admin_user_id': 7}, headers=_internal())

    assert res.status_code == 200 and res.get_json() == {'number': 2}
    v2 = _versions(order_id)[1]
    assert (v2.author, v2.admin_user_id) == ('admin', 7)
    history = client.get(f'/api/v1/order/{order_id}/versions', headers=_internal()).get_json()
    assert history['current_number'] == 2


@pytest.mark.parametrize('method', ['get', 'post'])
def test_the_version_routes_are_internal_only(client, customer, method):
    order_id = _sent_order(client, customer)

    res = getattr(client, method)(f'/api/v1/order/{order_id}/versions', json={}, headers=_auth(customer))

    assert res.status_code == 403
    assert len(_versions(order_id)) == 1


def test_a_failure_saving_the_version_does_not_break_the_edit(client, customer, monkeypatch, caplog):
    order_id = _sent_order(client, customer)

    def broken(*args):
        raise RuntimeError('boom')
    monkeypatch.setattr(versions, '_record', broken)

    _edit(client, customer, order_id, comments='1 sofa')

    assert db.session.get(Order, order_id).comments == '1 sofa'
    assert len(_versions(order_id)) == 1
    assert 'No se pudo guardar la versión de la orden' in caplog.text


def test_the_backfill_gives_sent_orders_their_version_1_once(client, customer):
    order_id = _create_order(client, customer)
    order = db.session.get(Order, order_id)
    order.carrier_notified_at = datetime(2026, 11, 1, 15, 0)
    order.quotation_requested = True
    db.session.commit()
    _create_order(client, customer)  # nunca salió: no se toca

    assert backfill() == 1
    assert _versions(order_id) == []
    assert backfill(apply=True) == 1
    assert backfill(apply=True) == 0

    [v1] = _versions(order_id)
    assert v1.notified_at == datetime(2026, 11, 1, 15, 0)


# --- Lo que ve el transportista (fase 2) --------------------------------------

def _carrier_view(client, order_id, company):
    token = CarrierCompanyEntity().generate_carrier_company_token(3600, order_id, company.id)
    res = client.get('/api/v1/orders/details', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    return res.get_json()['changes']


def _change(order_id, author='customer', **fields):
    """Cambia la orden por el ORM (las fechas no pasan por el PUT en SQLite) y
    guarda la versión, como lo haría la ruta."""
    order = db.session.get(Order, order_id)
    for name, value in fields.items():
        setattr(order, name, value)
    db.session.commit()
    return record_version(order_id, author)


@pytest.fixture
def fee(monkeypatch):
    monkeypatch.setenv('PLATFORM_FEE', '0.1')


def test_the_carrier_sees_what_changed_since_it_quoted_until_it_quotes_again(client, customer, carrier_company, fee):
    order_id = _sent_order(client, customer)
    _quote(client, order_id, carrier_company)
    assert _carrier_view(client, order_id, carrier_company) is None

    _change(order_id, comments='1 sofa\n3 cajas\n1 refrigeradora')

    changes = _carrier_view(client, order_id, carrier_company)
    assert changes['since'] == 'quotation'
    assert _fields(changes['entries']) == ['comments']
    assert changes['history'][0]['author'] == 'customer'

    _quote(client, order_id, carrier_company)
    assert _carrier_view(client, order_id, carrier_company) is None


def test_a_quotation_cancelled_by_the_change_is_still_what_it_read(client, customer, carrier_company, fee):
    order_id = _sent_order(client, customer)
    _quote(client, order_id, carrier_company)
    # Fuera de los 15 minutos del aviso, el cambio del cliente cancela su cotización.
    db.session.get(Order, order_id).carrier_notified_at = datetime.utcnow() - timedelta(hours=1)
    db.session.commit()

    _edit(client, customer, order_id, comments='1 sofa')

    assert Quotations.query.one().quotation_status_id == QuotationStatus.Cancelled()
    changes = _carrier_view(client, order_id, carrier_company)
    assert changes['since'] == 'quotation'
    assert 'comments' in _fields(changes['entries'])


def test_a_carrier_that_never_quoted_sees_the_changes_since_it_was_sent(client, customer, carrier_company, fee):
    order_id = _sent_order(client, customer)
    _change(order_id, comments='1 sofa')
    _change(order_id, author='admin', loaders_quantity=2)

    changes = _carrier_view(client, order_id, carrier_company)

    assert changes['since'] == 'sent'
    assert _fields(changes['entries']) == ['comments', 'loaders_quantity']
    assert [(v['number'], v['author']) for v in changes['history']] == [(2, 'customer'), (3, 'chalan')]
    assert all(set(v) == {'number', 'created_date', 'author', 'entries'} for v in changes['history'])


def test_the_budget_is_shown_without_the_fee(client, customer, carrier_company, fee):
    order_id = _sent_order(client, customer)  # presupuesto 500

    _change(order_id, approximate_budget=650)

    [entry] = _carrier_view(client, order_id, carrier_company)['entries']
    assert (entry['before'], entry['after']) == ('S/ 455', 'S/ 591')


def test_the_budget_of_a_referred_order_is_also_without_the_agent_commission(client, customer, carrier_company, fee):
    order_id = _sent_order(client, customer)
    agent = AdminUser(role='real_estate_agent', commission_rate=0.05)
    db.session.add(agent)
    db.session.commit()
    db.session.add(ReferredOrder(admin_user_id=agent.id, order_id=order_id))
    db.session.commit()

    _change(order_id, approximate_budget=650)

    [entry] = _carrier_view(client, order_id, carrier_company)['entries']
    assert (entry['before'], entry['after']) == ('S/ 435', 'S/ 565')


def test_a_budget_change_the_fee_hides_is_no_change_for_the_carrier(client, customer, carrier_company, fee):
    order_id = _sent_order(client, customer)  # 500 / 1.1 = 454.5

    _change(order_id, approximate_budget=500.2)

    assert _carrier_view(client, order_id, carrier_company) is None


def _district_changes(client, order_id, company):
    res = client.get(f'/api/v1/order/{order_id}/changes',
                     query_string={'carrier_company_id': company.id, 'address': 'district'},
                     headers=_internal())
    assert res.status_code == 200
    return res.get_json()['changes']


def test_with_the_district_only_no_street_comes_out(client, customer, carrier_company, fee):
    order_id = _sent_order(client, customer)
    order = db.session.get(Order, order_id)
    destination = order.order_details.filter_by(type='deliver_to').first()
    destination.street = 'Av. Arequipa 2000, Lince 15046, Perú'
    destination.interior_number = 'Dpto 401'
    origin = order.order_details.filter_by(type='carry_from').first()
    origin.street = 'Jr. Huiracocha 2050, Jesús María 15072, Perú'
    db.session.commit()
    record_version(order_id, 'customer')

    changes = _district_changes(client, order_id, carrier_company)

    entries = {e['field']: e for e in changes['entries']}
    assert (entries['origin.street']['before'], entries['origin.street']['after']) == ('San Isidro', 'Jesús María')
    assert entries['destination.street']['before'] is None
    assert entries['destination.street']['after'] == 'Cambió la dirección (sigue en Lince)'
    assert 'destination.interior_number' not in entries
    text = repr(changes)
    for secret in ('Arequipa', 'Mercaderes', 'Javier Prado', 'Huiracocha', 'Dpto 401', '2000'):
        assert secret not in text


def test_the_full_link_keeps_the_street(client, customer, carrier_company, fee):
    order_id = _sent_order(client, customer)
    destination = db.session.get(Order, order_id).order_details.filter_by(type='deliver_to').first()
    destination.street = 'Av. Arequipa 2000, Lince 15046, Perú'
    db.session.commit()
    record_version(order_id, 'customer')

    [entry] = _carrier_view(client, order_id, carrier_company)['entries']

    assert entry['after'] == 'Av. Arequipa 2000, Lince 15046, Perú'


def test_a_carrier_that_was_not_chosen_sees_nothing(client, customer, carrier_company, fee):
    order_id = _sent_order(client, customer)
    other = CarrierCompany(name='Otra', active=1)
    db.session.add(other)
    db.session.commit()
    db.session.add(Quotations(order_id=order_id, carrier_company_id=other.id, amount=300,
                              quotation_status_id=QuotationStatus.Selected()))
    db.session.commit()

    _change(order_id, comments='1 sofa')

    assert _carrier_view(client, order_id, carrier_company) is None
    # La elegida sí lo ve: cotizó antes del historial, así que contra la versión 1.
    assert _carrier_view(client, order_id, other)['since'] == 'quotation'


def test_the_changes_route_is_internal_and_needs_the_company_and_the_address(client, customer, carrier_company):
    order_id = _sent_order(client, customer)
    url = f'/api/v1/order/{order_id}/changes'

    assert client.get(url, query_string={'carrier_company_id': carrier_company.id, 'address': 'full'},
                      headers=_auth(customer)).status_code == 403
    assert client.get(url, query_string={'address': 'full'}, headers=_internal()).status_code == 400
    assert client.get(url, query_string={'carrier_company_id': carrier_company.id, 'address': 'street'},
                      headers=_internal()).status_code == 400
