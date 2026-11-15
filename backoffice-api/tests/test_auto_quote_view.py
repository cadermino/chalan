"""Lo calculado en silencio con las tarifas, al lado de lo que cada empresa cotizó.

Lo que se prueba es lo que haría encender a una empresa que no acierta, o no
encender a una que sí: comparar con la cotización de otra versión de la orden,
contar estimaciones sin cotización real, medir con tarifas que ya no son las de
la empresa, dar por lista a una que cotiza de menos, sugerirle tarifas que no
salen de lo que cotizó, y que lo vea alguien que no es admin.
"""
from datetime import datetime, timedelta

import pytest

from app import db
from app.models import AutoQuoteEstimate, CarrierRates, Order, Quotation
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


def estimate(order, company, amount, notified=NOTIFIED, reason=None, **move):
    row = AutoQuoteEstimate(order_id=order.id, carrier_company_id=company.id, notified_at=notified, amount=amount,
                            skip_reason=reason, inputs={'m3': 5, **move}, lines=[{'label': 'Base', 'amount': 200}])
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


def test_companies_without_rates_show_only_if_they_quoted(client, catalog, company, superadmin):
    quoted = make_company('Cotizó SAC', 'moving')
    silent = make_company('Calló SAC', 'moving')
    order = make_order()
    estimate(order, company, 400)
    estimate(order, quoted, None, reason='no_rates')
    estimate(order, silent, None, reason='no_rates')
    quote(order, quoted, 380, NOTIFIED + timedelta(minutes=5))

    rows = client.get(f'/api/orders/{order.id}/auto-quote', headers=superadmin).get_json()['estimates']

    assert [(r['name'], r['skip_label'], r['quoted']) for r in rows] == [
        ('Mudanzas SAC', None, None), ('Cotizó SAC', 'Sin tarifas', 380)]


def set_rates(company, **rates):
    db.session.add(CarrierRates(carrier_company_id=company.id, **{'base_fee': 200, 'per_m3': 20, **rates}))
    db.session.commit()


def compared(company, quoted, m3=5, amount=None, reason=None, **move):
    order = make_order()
    estimate(order, company, amount, reason=reason, m3=m3, **move)
    if quoted is not None:
        quote(order, company, quoted, NOTIFIED + timedelta(minutes=30))


def accuracy(client, company, headers):
    return client.get(f'/api/carrier-companies/{company.id}/auto-quote-accuracy', headers=headers).get_json()


def test_accuracy_is_measured_with_the_rates_of_today(client, company, superadmin):
    set_rates(company)                                    # 200 + 5 × 20 = 300
    compared(company, 310, amount=999)                    # lo calculado con las tarifas de antes no cuenta
    compared(company, 450, reason='no_rates')             # del historial, de cuando no tenía tarifas
    compared(company, 200)
    compared(company, None, amount=300)                   # nunca cotizó
    compared(company, 300, reason='unavailable')          # no podía ese día: no se compara
    compared(company, 300, reason='declined')

    body = accuracy(client, company, superadmin)

    assert (body['has_rates'], body['quotations'], body['compared']) == (True, 3, 3)
    assert sorted((r['amount'], r['quoted'], r['error']) for r in body['recent']) == [
        (300, 200, 0.5), (300, 310, -0.032), (300, 450, -0.333)]
    # 310: cerca. 450: más de 25% por debajo. 200: más de 40% por arriba.
    assert (body['near'], body['low'], body['high']) == (1, 1, 1)
    assert body['ready'] is False


def test_the_rates_use_the_whole_move(client, company, superadmin):
    set_rates(company, per_loader=50, per_floor=10, weekend_surcharge_percent=10)
    compared(company, 500, m3=10, loaders=2, floors=3, weekend=True)

    [row] = accuracy(client, company, superadmin)['recent']

    assert row['amount'] == round((200 + 200 + 100 + 30) * 1.1)


@pytest.mark.parametrize('quotes, ready', [
    ([300] * 10, True),
    ([300] * 9, False),                                   # todavía pocas
    ([300] * 9 + [450], True),                            # 1 de 10 muy por debajo se tolera
    ([300] * 8 + [450] * 2, False),                       # 2 de 10 no: cotizaría de menos
    ([300] * 6 + [200] * 4, True),                        # de más pierde la orden, no ata a nadie
    ([300] * 5 + [200] * 5, False),                       # pero no la mitad
])
def test_ready_means_rarely_far_below_and_mostly_near(client, company, superadmin, quotes, ready):
    set_rates(company)
    for quoted in quotes:
        compared(company, quoted)

    assert accuracy(client, company, superadmin)['ready'] is ready


def test_without_rates_nothing_is_compared_but_the_history_counts(client, company, superadmin):
    for _ in range(3):
        compared(company, 300, reason='no_rates')

    body = accuracy(client, company, superadmin)

    assert (body['has_rates'], body['quotations'], body['compared'], body['ready']) == (False, 3, 0, False)
    assert body['suggested'] is None                      # con 3 cotizaciones no se sugiere nada


def test_rates_are_suggested_from_what_the_company_quoted(client, company, superadmin):
    # Cotiza 180 + 15 por m³ + 50 por cargador + 20 por piso, sin saberlo.
    for m3, loaders, floors in ((2, 0, 0), (4, 1, 0), (6, 1, 2), (8, 2, 0), (10, 2, 3), (12, 1, 1), (15, 2, 2),
                                (18, 3, 0), (20, 2, 4), (25, 3, 1), (3, 0, 1), (7, 1, 3)):
        compared(company, 180 + 15 * m3 + 50 * loaders + 20 * floors, reason='no_rates', m3=m3, loaders=loaders,
                 floors=floors)

    suggested = accuracy(client, company, superadmin)['suggested']

    assert suggested['rates'] == {'base_fee': 180, 'per_m3': 15, 'per_loader': 50, 'per_floor': 20}
    assert (suggested['near_share'], suggested['low_share'], suggested['ready']) == (1, 0, True)


def test_suggested_rates_go_up_until_they_are_rarely_far_below(client, company, superadmin):
    # La mitad de las veces cobra 300 y la otra 640 por la misma mudanza: el
    # promedio (470) queda más de 25% abajo de la mitad. Se sube hasta que no.
    for i in range(12):
        compared(company, 300 if i % 2 else 640, reason='no_rates')

    suggested = accuracy(client, company, superadmin)['suggested']

    assert suggested['rates']['base_fee'] + 5 * suggested['rates']['per_m3'] == 480
    assert suggested['low_share'] == 0


def test_the_weekend_surcharge_is_not_counted_twice_in_the_suggestion(client, company, superadmin):
    set_rates(company, weekend_surcharge_percent=20)
    for i, m3 in enumerate((2, 4, 6, 8, 10, 12, 15, 18, 20, 25)):
        weekend = i % 2 == 0
        compared(company, round((200 + 10 * m3) * (1.2 if weekend else 1)), m3=m3, weekend=weekend)

    suggested = accuracy(client, company, superadmin)['suggested']

    assert (suggested['rates']['base_fee'], suggested['rates']['per_m3']) == (200, 10)
    assert suggested['near_share'] == 1


def test_only_admins_see_it(client, company):
    carrier = make_user('carrier_company', carrier_company_id=company.id, suffix='c')
    order = make_order()

    assert client.get(f'/api/orders/{order.id}/auto-quote', headers=carrier).status_code == 403
    assert client.get(f'/api/carrier-companies/{company.id}/auto-quote-accuracy',
                      headers=carrier).status_code == 403
