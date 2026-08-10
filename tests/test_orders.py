from datetime import datetime

import pytest

from app import db
from app.api.orders import send_email_to_carrier_companies
from app.models import LuServices, Order, OrdersServices


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
