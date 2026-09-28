from datetime import datetime

import pytest

from app import db
from app.api.decorators import generate_internal_token
from app.api.order import Order as OrderEntity
from app.api.order.steps.addresses import Addresses as AddressesStep
from app.api.orders import send_email_to_carrier_companies
from app.api.order.order_status import OrderStatus
from app.models import LuServices, Order, OrdersServices, PaymentType, Quotations


ORIGIN = {
    'from_street': 'Av. Javier Prado 123',
    'from_floor_number': 3,
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


def test_create_order_without_authenticated_customer_succeeds(client):
    # Customers fill out step-one (and even step-two) before logging in —
    # login/register is deferred to step-three. Vuex defaults customer_id to
    # null until then, so this is the default/most common path, not an edge
    # case. Regression test for the bug fixed in 9c23efb.
    res = client.post('/api/v1/order', json={
        'customer': {'customer_id': None},
        'orderDetailsOrigin': ORIGIN,
        'orderDetailsDestination': DESTINATION,
    })

    assert res.status_code == 201
    assert res.get_json()['order_id']


def test_create_order_with_real_customer_id_succeeds(client, customer):
    res = client.post('/api/v1/order', json={
        'customer': {'customer_id': customer.id},
        'orderDetailsOrigin': ORIGIN,
        'orderDetailsDestination': DESTINATION,
    })

    assert res.status_code == 201


def test_create_order_missing_customer_key_returns_clean_400(client):
    res = client.post('/api/v1/order', json={
        'orderDetailsOrigin': ORIGIN,
        'orderDetailsDestination': DESTINATION,
    })

    assert res.status_code == 400
    assert 'customer.customer_id' in res.get_json()['message']


def test_create_order_missing_order_details_returns_clean_400(client):
    res = client.post('/api/v1/order', json={
        'customer': {'customer_id': None},
        'orderDetailsDestination': DESTINATION,
    })

    assert res.status_code == 400
    assert 'orderDetailsOrigin' in res.get_json()['message']


def _create_order(client, customer):
    res = client.post('/api/v1/order', json={
        'customer': {'customer_id': customer.id},
        'orderDetailsOrigin': ORIGIN,
        'orderDetailsDestination': DESTINATION,
    })
    return res.get_json()['order_id']


def _make_belongings_complete(order_id):
    # Drives Order/OrdersServices state directly via the ORM rather than
    # through PUT /order/<id>: that endpoint writes appointment_date via a
    # raw ISO string (order.py:83, `order.appointment_date = request[...]`),
    # which Postgres/psycopg2 casts automatically but SQLAlchemy's SQLite
    # test dialect rejects outright ("only accepts Python datetime and date
    # objects"). Real production behavior is already verified separately
    # (curl against prod, see chalan-chatbot-quotation-spec.md) — this just
    # avoids a SQLite-only false failure while still exercising the real
    # send_email_to_carrier_companies()/is_complete() logic under test.
    order = db.session.get(Order, order_id)
    order.appointment_date = datetime(2026, 8, 20, 14, 0)
    order.comments = '1 sofa, 3 cajas'
    cargo = LuServices.query.filter_by(service='cargo').first()
    db.session.add(OrdersServices(order_id=order_id, service_id=cargo.id))
    db.session.commit()


def test_request_quotation_notifies_active_carrier_in_same_country(client, customer, carrier_company, monkeypatch):
    monkeypatch.setenv('COUNTRY_ID', '2')
    carrier_company.country_id = 2
    carrier_company.email = 'carrier@example.com'
    db.session.commit()

    order_id = _create_order(client, customer)
    _make_belongings_complete(order_id)

    emails_sent = send_email_to_carrier_companies(order_id, {'requestQuotationFromCarrierCompany': True})

    assert emails_sent == [carrier_company.id]


def test_carrier_with_no_country_id_is_never_notified(client, customer, carrier_company, monkeypatch):
    # Regression test for the country_id bug fixed in aeaeb36: a carrier
    # self-registered via /transportistas never had country_id set, so it
    # was silently excluded from every notification despite being active.
    monkeypatch.setenv('COUNTRY_ID', '2')
    carrier_company.country_id = None  # simulates the pre-fix self-registration bug
    db.session.commit()

    order_id = _create_order(client, customer)
    _make_belongings_complete(order_id)

    emails_sent = send_email_to_carrier_companies(order_id, {'requestQuotationFromCarrierCompany': True})

    assert emails_sent == []


def test_no_trigger_flag_notifies_nobody(client, customer, carrier_company, monkeypatch):
    # Completing address + belongings alone never notifies carriers — only
    # the explicit requestQuotationFromCarrierCompany flag does (Step-three.vue's
    # mount-time PUT). This is intentional, but easy to assume is automatic.
    monkeypatch.setenv('COUNTRY_ID', '2')
    carrier_company.country_id = 2
    db.session.commit()

    order_id = _create_order(client, customer)
    _make_belongings_complete(order_id)

    emails_sent = send_email_to_carrier_companies(order_id, {})

    assert emails_sent == []


def _update_payload(loaders_quantity=None):
    return {
        'customer': {'customer_id': None},
        'order': {
            'appointment_date': datetime(2026, 8, 20, 14, 0),
            'comments': '1 sofa, 3 cajas',
            'approximate_budget': 500,
            'loaders_quantity': loaders_quantity,
        },
        'orderDetailsOrigin': ORIGIN,
        'orderDetailsDestination': DESTINATION,
        'services': {'cargo': '1', 'packaging': '0'},
    }


def test_update_order_sets_loaders_quantity(client, customer):
    order_id = _create_order(client, customer)

    OrderEntity(order_id).update(_update_payload(loaders_quantity=3))

    order = db.session.get(Order, order_id)
    assert order.loaders_quantity == 3


def test_update_order_without_loaders_quantity_stays_none(client, customer):
    # loaders_quantity is optional — the "no extra loaders" case must not crash
    # or silently coerce to 0 (customer.get() returns None when absent).
    order_id = _create_order(client, customer)

    OrderEntity(order_id).update(_update_payload())

    order = db.session.get(Order, order_id)
    assert order.loaders_quantity is None


def test_ground_floor_counts_as_a_complete_address(client, customer):
    # Piso 0 es planta baja, no un campo vacío. Con bool() esas direcciones
    # quedaban incompletas para siempre y la orden nunca salía a cotizar.
    order_id = _create_order(client, customer)
    for detail in db.session.get(Order, order_id).order_details:
        detail.floor_number = 0
        detail.map_url = 'https://maps.google.com/z'
    db.session.commit()

    assert AddressesStep(order_id).is_complete() is True


def _auth(customer):
    return {'Authorization': f'Bearer {customer.generate_auth_token(3600)}'}


def _internal_auth():
    return {'Authorization': f'Bearer {generate_internal_token()}'}


def _route_update_payload(edited_by_customer):
    """Cuerpo de PUT /order/<id> tal como lo manda un cliente real.

    appointment_date va en None a proposito: la ruta escribe el string crudo
    del JSON (order.py:130) y el SQLite de estas pruebas solo acepta datetime
    de Python. Lo que se verifica aca es si la ruta escribe, no que formato de
    fecha parsea.
    """
    payload = {
        'customer': {'customer_id': None},
        'order': {
            'appointment_date': None,
            'comments': '1 sofa, 3 cajas',
            'approximate_budget': 500,
            'loaders_quantity': 2,
        },
        'orderDetailsOrigin': ORIGIN,
        'orderDetailsDestination': DESTINATION,
        'services': {'cargo': '1', 'packaging': '0'},
    }
    if edited_by_customer:
        payload['orderEditedByCustomer'] = True
    return payload


def test_put_with_edit_flag_persists_the_order(client, customer):
    # Los otros tests de update() llaman a OrderEntity directo y se saltean la
    # ruta, que es por donde entra todo el trafico real. Esta prueba existe
    # porque 02e8f88 dejo de escribir por HTTP sin que nada se pusiera en rojo:
    # el endpoint siguio respondiendo 200 "updated!" durante cuatro dias.
    order_id = _create_order(client, customer)

    res = client.put(
        f'/api/v1/order/{order_id}',
        json=_route_update_payload(edited_by_customer=True),
        headers=_auth(customer),
    )

    assert res.status_code == 200
    order = db.session.get(Order, order_id)
    assert order.comments == '1 sofa, 3 cajas'
    assert order.loaders_quantity == 2
    assert order.approximate_budget == 500
    assert [row.service.service for row in order.services] == ['cargo']


def test_put_without_edit_flag_writes_nothing(client, customer):
    # Login, registro, el paso tres y el modal de pago reenvian la orden entera
    # desde el localStorage del navegador: de esos PUT solo se toma ligar al
    # cliente. Sin esta prueba, sacar el guard de 02e8f88 vuelve a dejar que un
    # login pise la orden con una copia vieja y le cancele las cotizaciones.
    order_id = _create_order(client, customer)

    res = client.put(
        f'/api/v1/order/{order_id}',
        json=_route_update_payload(edited_by_customer=False),
        headers=_auth(customer),
    )

    assert res.status_code == 200
    order = db.session.get(Order, order_id)
    assert order.comments is None
    assert order.loaders_quantity is None
    assert order.services.count() == 0


def test_put_reports_what_it_wrote(client, customer):
    # El 200 de esta ruta no distinguia un PUT que escribio todo de uno que no
    # escribio nada, y por eso el bug de 02e8f88 vivio cuatro dias en dos
    # clientes a la vez. La respuesta ahora lo dice.
    order_id = _create_order(client, customer)

    full = client.put(
        f'/api/v1/order/{order_id}',
        json=_route_update_payload(edited_by_customer=True),
        headers=_auth(customer),
    ).get_json()

    assert full['written'] == 'full'
    assert 'comments' in full['fields_written']
    assert 'loaders_quantity' in full['fields_written']
    assert 'updated!' in full['message']

    link_only = client.put(
        f'/api/v1/order/{order_id}',
        json=_route_update_payload(edited_by_customer=False),
        headers=_auth(customer),
    ).get_json()

    assert link_only['written'] == 'customer_link'
    assert link_only['fields_written'] == []
    assert 'updated!' not in link_only['message']


def test_internal_caller_without_the_edit_flag_is_rejected(client, customer):
    # El backoffice-api manda el cuerpo entero a proposito y siempre quiere
    # escribirlo; si olvida la marca es un bug nuestro, no un navegador
    # reenviando localStorage. Controlamos las dos puntas, asi que falla fuerte.
    order_id = _create_order(client, customer)

    res = client.put(
        f'/api/v1/order/{order_id}',
        json=_route_update_payload(edited_by_customer=False),
        headers=_internal_auth(),
    )

    assert res.status_code == 400
    assert 'orderEditedByCustomer' in res.get_json()['message']


def test_internal_caller_with_the_edit_flag_writes(client, customer):
    order_id = _create_order(client, customer)

    res = client.put(
        f'/api/v1/order/{order_id}',
        json=_route_update_payload(edited_by_customer=True),
        headers=_internal_auth(),
    )

    assert res.status_code == 200
    assert res.get_json()['written'] == 'full'
    assert db.session.get(Order, order_id).comments == '1 sofa, 3 cajas'


def test_cash_checkout_moves_the_order_to_in_progress(client, customer, carrier_company, monkeypatch):
    # Agendar es lo unico que pone la orden en marcha. Antes ese estado lo
    # escribia el PUT del modal de pago, que desde 02e8f88 no escribe nada, y
    # la orden se quedaba en pending aunque estuviera cobrada: el transportista
    # no la veia en su lista y no podia marcarla completada.
    from app.api.order import order as order_module
    order_module._PAYMENT_TYPE_IDS.clear()
    monkeypatch.setenv('PLATFORM_FEE', '0.1')
    monkeypatch.setenv('SITE_URL', 'https://chalan.pe/')
    monkeypatch.setattr('app.api.orders.send_email', lambda *args, **kwargs: None)

    db.session.add_all([PaymentType(type='cash'), PaymentType(type='yape')])
    carrier_company.email = 'carrier@example.com'
    db.session.commit()

    order_id = _create_order(client, customer)
    db.session.add(Quotations(
        order_id=order_id,
        carrier_company_id=carrier_company.id,
        amount=200,
        quotation_status_id=2,
    ))
    db.session.commit()
    assert db.session.get(Order, order_id).order_status_id == OrderStatus.pending()

    res = client.put(f'/api/v1/order/checkout-cash/{order_id}', headers=_auth(customer))

    assert res.status_code == 200
    assert res.get_json()['created'] is True
    assert db.session.get(Order, order_id).order_status_id == OrderStatus.in_progress()


def test_cash_checkout_is_idempotent(client, customer, carrier_company, monkeypatch):
    # Volver desde el dashboard y confirmar otra vez la misma cotizacion pasa
    # por aca de nuevo: ni duplica pagos ni reenvia correos, y el estado ya
    # escrito se queda como esta.
    from app.api.order import order as order_module
    order_module._PAYMENT_TYPE_IDS.clear()
    monkeypatch.setenv('PLATFORM_FEE', '0.1')
    monkeypatch.setenv('SITE_URL', 'https://chalan.pe/')
    monkeypatch.setattr('app.api.orders.send_email', lambda *args, **kwargs: None)

    db.session.add_all([PaymentType(type='cash'), PaymentType(type='yape')])
    carrier_company.email = 'carrier@example.com'
    db.session.commit()

    order_id = _create_order(client, customer)
    db.session.add(Quotations(
        order_id=order_id,
        carrier_company_id=carrier_company.id,
        amount=200,
        quotation_status_id=2,
    ))
    db.session.commit()

    client.put(f'/api/v1/order/checkout-cash/{order_id}', headers=_auth(customer))
    again = client.put(f'/api/v1/order/checkout-cash/{order_id}', headers=_auth(customer))

    assert again.get_json()['created'] is False
    assert db.session.get(Order, order_id).order_status_id == OrderStatus.in_progress()
