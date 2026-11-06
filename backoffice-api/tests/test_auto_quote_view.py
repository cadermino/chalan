"""Lo calculado en silencio con las tarifas, al lado de lo que cada empresa cotizó.

Lo que se prueba es lo que haría encender a una empresa que no acierta, o no
encender a una que sí: comparar con la cotización de otra versión de la orden,
contar estimaciones sin cotización real, y que lo vea alguien que no es admin.
"""
from datetime import datetime, timedelta

import pytest

from app import db
from app.models import AutoQuoteEstimate, Order, Quotation
from tests.test_service_requests import make_user
from tests.test_services_per_company import catalog, make_company  # noqa: F401

NOTIFIED = datetime(2026, 11, 10, 14, 0)


@pytest.fixture
def superadmin(app):
    return make_user('superadmin')


@pytest.fixture
def company(catalog):
    return make_company('Mudanzas SAC', 'moving')


def make_order(**fields):
    order = Order(order_status_id=1, customer_id=1, appointment_date=datetime(2026, 11, 12, 9),
                  carrier_notified_at=NOTIFIED, **fields)
    db.session.add(order)
    db.session.commit()
    return order


def estimate(order, company, amount, notified=NOTIFIED, reason=None):
    row = AutoQuoteEstimate(order_id=order.id, carrier_company_id=company.id, notified_at=notified, amount=amount,
                            skip_reason=reason, inputs={'m3': 5}, lines=[{'label': 'Base', 'amount': 200}])
    db.session.add(row)
    db.session.commit()
    return row


def quote(order, company, amount, at, status=1):
    db.session.add(Quotation(order_id=order.id, carrier_company_id=company.id, amount=amount,
                             quotation_status_id=status, created_date=at, updated_date=at))
    db.session.commit()


def test_the_order_shows_each_estimate_next_to_the_real_quote(client, catalog, company, superadmin):
    other = make_company('Otra SAC', 'moving')
    order = make_order(estimated_volume_m3=5.1, volume_breakdown={'m3': 5.1, 'items': [], 'unknown': []},
                       auto_quote_checked_at=NOTIFIED + timedelta(minutes=20))
    estimate(order, company, 400)
    estimate(order, other, None, reason='unavailable')
    quote(order, company, 500, NOTIFIED + timedelta(minutes=5))

    body = client.get(f'/api/orders/{order.id}/auto-quote', headers=superadmin).get_json()

    assert body['estimated_volume_m3'] == 5.1
    first, second = body['estimates']
    assert (first['name'], first['amount'], first['quoted'], first['error']) == ('Mudanzas SAC', 400, 500, -0.2)
    assert (second['amount'], second['skip_label']) == (None, 'No puede ese día')


def test_only_the_last_notice_is_shown_and_quotes_are_matched_to_their_notice(client, company, superadmin):
    order = make_order()
    renotified = NOTIFIED + timedelta(days=1)
    estimate(order, company, 400)
    estimate(order, company, 300, notified=renotified)
    quote(order, company, 450, NOTIFIED + timedelta(hours=1), status=3)   # de antes del cambio
    quote(order, company, 320, renotified + timedelta(hours=1))

    [row] = client.get(f'/api/orders/{order.id}/auto-quote', headers=superadmin).get_json()['estimates']

    assert (row['amount'], row['quoted']) == (300, 320)


def test_an_order_out_of_scope_says_why(client, company, superadmin):
    order = make_order(auto_quote_skip='outside_lima', auto_quote_checked_at=NOTIFIED)

    body = client.get(f'/api/orders/{order.id}/auto-quote', headers=superadmin).get_json()

    assert body['estimates'] == []
    assert body['skip_label'] == 'Origen o destino fuera de Lima'


def test_accuracy_counts_only_estimates_with_a_real_quote(client, company, superadmin):
    for amount, quoted in ((400, 420), (400, 600), (300, 290)):
        order = make_order()
        estimate(order, company, amount)
        quote(order, company, quoted, NOTIFIED + timedelta(minutes=30))
    estimate(make_order(), company, 350)                              # nunca cotizó
    estimate(make_order(), company, None, reason='unavailable')

    body = client.get(f'/api/carrier-companies/{company.id}/auto-quote-accuracy', headers=superadmin).get_json()

    assert (body['estimated'], body['compared'], body['hits']) == (4, 3, 2)
    assert body['ready'] is False   # muy pocas todavía
    assert {r['quoted'] for r in body['recent']} == {420, 600, 290}


def test_a_company_that_hits_often_enough_is_ready(client, company, superadmin):
    for i in range(10):
        order = make_order()
        estimate(order, company, 400)
        quote(order, company, 400 if i < 8 else 700, NOTIFIED + timedelta(minutes=30))

    body = client.get(f'/api/carrier-companies/{company.id}/auto-quote-accuracy', headers=superadmin).get_json()

    assert (body['compared'], body['share'], body['ready']) == (10, 0.8, True)


def test_only_admins_see_it(client, company):
    carrier = make_user('carrier_company', carrier_company_id=company.id, suffix='c')
    order = make_order()

    assert client.get(f'/api/orders/{order.id}/auto-quote', headers=carrier).status_code == 403
    assert client.get(f'/api/carrier-companies/{company.id}/auto-quote-accuracy',
                      headers=carrier).status_code == 403
