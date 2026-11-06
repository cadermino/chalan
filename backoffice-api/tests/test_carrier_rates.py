"""Tarifas y disponibilidad de las empresas (migración 047).

Lo que se prueba es lo que haría cotizar mal a nombre de un transportista: una
fórmula que no suma lo que dice el desglose, una tarifa escrita en céntimos, un
permiso para cotizar por la empresa sin tarifas o sin saber quién lo dio, un
día bloqueado que no se respeta, y que una empresa toque las tarifas de otra.
"""
from datetime import datetime, timedelta

import pytest

from app import db
from app.carrier_rates import estimate, lima_today
from app.models import CarrierAvailability, CarrierRates, Quotation
from tests.test_carrier_reminders import make_order, reminders
from tests.test_service_requests import make_user
from tests.test_services_per_company import catalog, make_company  # noqa: F401

RATES = {'base_fee': 200, 'per_m3': 15, 'per_loader': 60, 'per_floor': 20, 'minimum_fare': 250,
         'per_km_outside_lima': 4.5, 'weekend_surcharge_percent': 10}


@pytest.fixture
def superadmin(app):
    return make_user('superadmin')


@pytest.fixture
def company(catalog):
    return make_company('Mudanzas SAC', 'moving')


@pytest.fixture
def carrier(company):
    return make_user('carrier_company', carrier_company_id=company.id, suffix='c')


# ── La fórmula ──

def test_a_move_in_lima_is_base_plus_what_it_carries():
    result = estimate(RATES, m3=12, floors=3, loaders=2)

    # 200 + 12 × 15 + 2 × 60 + 3 × 20
    assert result['total'] == 560
    assert [line['amount'] for line in result['lines']] == [200, 180, 120, 60]
    assert not result['minimum_applied']


def test_outside_lima_the_km_are_added_and_inside_they_are_not():
    assert estimate(RATES, m3=12, km=300)['total'] == 380
    assert estimate(RATES, m3=12, km=300, outside_lima=True)['total'] == 380 + 1350


def test_the_weekend_surcharge_goes_on_everything():
    assert estimate(RATES, m3=12, loaders=2, weekend=True)['total'] == 550  # 500 + 10%


def test_a_small_move_pays_the_minimum():
    result = estimate(RATES, m3=1)

    assert result['total'] == 250
    assert result['minimum_applied']


def test_the_total_is_rounded_to_soles():
    assert estimate({**RATES, 'per_m3': 15.5, 'minimum_fare': None}, m3=1.3)['total'] == 220  # 220.15


def test_without_a_base_or_a_price_per_m3_there_is_no_estimate():
    assert estimate({**RATES, 'base_fee': None}, m3=12) is None
    assert estimate({**RATES, 'per_m3': None}, m3=12) is None


# ── Guardar tarifas ──

def test_a_company_saves_its_rates_and_reads_them_back(client, company, carrier):
    res = client.put(f'/api/carrier-companies/{company.id}/rates', json={**RATES, 'moves_per_day': 2},
                     headers=carrier)

    assert res.status_code == 200
    body = client.get(f'/api/carrier-companies/{company.id}/rates', headers=carrier).get_json()
    assert body['rates']['per_km_outside_lima'] == 4.5
    assert body['rates']['moves_per_day'] == 2
    assert body['complete'] is True


def test_fields_that_are_not_sent_stay_as_they_were(client, company, carrier):
    client.put(f'/api/carrier-companies/{company.id}/rates', json=RATES, headers=carrier)
    client.put(f'/api/carrier-companies/{company.id}/rates', json={'per_m3': 18}, headers=carrier)

    rates = CarrierRates.query.one()
    assert (float(rates.base_fee), float(rates.per_m3)) == (200, 18)


@pytest.mark.parametrize('field, value', [
    ('per_m3', 1500),          # céntimos: S/ 15 escrito como 1500
    ('base_fee', -10),
    ('per_loader', True),
    ('per_km_outside_lima', 'mucho'),
    ('max_km', 12.5),
    ('moves_per_day', 0),
    ('moves_per_day', None),
])
def test_rates_that_cannot_be_right_are_rejected(client, company, carrier, field, value):
    res = client.put(f'/api/carrier-companies/{company.id}/rates', json={**RATES, field: value}, headers=carrier)

    assert res.status_code == 400
    assert res.get_json()['field'] == field
    assert CarrierRates.query.count() == 0


def test_a_company_cannot_see_or_change_another_ones_rates(client, catalog, carrier):
    other = make_company('Otra SAC', 'moving')

    assert client.get(f'/api/carrier-companies/{other.id}/rates', headers=carrier).status_code == 403
    assert client.put(f'/api/carrier-companies/{other.id}/rates', json=RATES, headers=carrier).status_code == 403


def test_an_admin_loads_the_rates_a_carrier_dictates(client, company, superadmin):
    res = client.put(f'/api/carrier-companies/{company.id}/rates', json=RATES, headers=superadmin)

    assert res.status_code == 200
    assert CarrierRates.query.one().carrier_company_id == company.id


# ── Permiso para cotizar por la empresa ──

def test_quoting_for_a_company_needs_its_rates(client, company, carrier):
    res = client.put(f'/api/carrier-companies/{company.id}/rates',
                     json={'per_loader': 60, 'auto_quote': True}, headers=carrier)

    assert res.status_code == 400
    assert res.get_json()['field'] == 'auto_quote'
    assert CarrierRates.query.count() == 0


def test_the_permission_records_who_gave_it(client, company, carrier):
    res = client.put(f'/api/carrier-companies/{company.id}/rates', json={**RATES, 'auto_quote': True},
                     headers=carrier)

    rates = res.get_json()['rates']
    assert rates['auto_quote'] is True
    assert rates['auto_quote_authorized_by']['is_company'] is True
    assert rates['auto_quote_authorized_at'] is not None


def test_saving_other_rates_keeps_who_authorized(client, company, carrier, superadmin):
    client.put(f'/api/carrier-companies/{company.id}/rates', json={**RATES, 'auto_quote': True}, headers=carrier)
    first = CarrierRates.query.one().auto_quote_authorized_at

    client.put(f'/api/carrier-companies/{company.id}/rates', json={'per_m3': 16}, headers=superadmin)

    rates = CarrierRates.query.one()
    assert rates.auto_quote and rates.auto_quote_authorized_at == first


def test_rates_cannot_be_left_incomplete_while_quoting_for_the_company(client, company, carrier):
    client.put(f'/api/carrier-companies/{company.id}/rates', json={**RATES, 'auto_quote': True}, headers=carrier)

    res = client.put(f'/api/carrier-companies/{company.id}/rates', json={'per_m3': None}, headers=carrier)

    assert res.status_code == 400
    assert float(CarrierRates.query.one().per_m3) == 15


def test_withdrawing_the_permission_forgets_who_gave_it(client, company, carrier):
    client.put(f'/api/carrier-companies/{company.id}/rates', json={**RATES, 'auto_quote': True}, headers=carrier)

    client.put(f'/api/carrier-companies/{company.id}/rates', json={'auto_quote': False}, headers=carrier)

    rates = CarrierRates.query.one()
    assert not rates.auto_quote
    assert rates.auto_quote_authorized_by is None and rates.auto_quote_authorized_at is None


# ── Simulador ──

def test_the_simulator_prices_example_moves_without_saving(client, company, carrier):
    res = client.post(f'/api/carrier-companies/{company.id}/rates/simulate', json={
        'rates': {**RATES, 'per_floor': 'veinte'},
        'scenarios': [{'m3': 12, 'floors': 3, 'loaders': 2}, {'m3': 12, 'km': 300, 'outside_lima': True}],
    }, headers=carrier)

    body = res.get_json()
    assert res.status_code == 200
    assert [r['total'] for r in body['results']] == [500, 1730]   # sin el piso mal escrito
    assert 'per_floor' in body['errors']
    assert CarrierRates.query.count() == 0


def test_the_simulator_says_when_it_cannot_price_yet(client, company, carrier):
    res = client.post(f'/api/carrier-companies/{company.id}/rates/simulate',
                      json={'rates': {'per_loader': 60}, 'scenarios': [{'m3': 5}]}, headers=carrier)

    assert res.get_json()['results'] == [None]
    assert res.get_json()['complete'] is False


# ── Calendario ──

def _day(days_ahead):
    return lima_today() + timedelta(days=days_ahead)


def _calendar(client, company, headers, start, end):
    res = client.get(f'/api/carrier-companies/{company.id}/availability?from={start}&to={end}', headers=headers)
    assert res.status_code == 200
    return {d['date']: d for d in res.get_json()['days']}


def test_every_day_is_available_until_the_company_says_otherwise(client, company, carrier):
    days = _calendar(client, company, carrier, _day(0), _day(6))

    assert len(days) == 7
    assert all(d['blocked'] is None for d in days.values())


def test_the_week_blocks_the_same_day_every_week(client, company, carrier):
    sunday_off = [None] * 6 + ['day']
    assert client.put(f'/api/carrier-companies/{company.id}/availability/weekly',
                      json={'weekly': sunday_off}, headers=carrier).status_code == 200

    days = _calendar(client, company, carrier, _day(0), _day(13))

    sundays = [d for d in days.values() if datetime.fromisoformat(d['date']).weekday() == 6]
    assert len(sundays) == 2
    assert all(d['blocked'] == 'day' and d['source'] == 'week' for d in sundays)
    assert all(d['blocked'] is None for d in days.values() if d not in sundays)


def test_a_day_can_be_opened_even_if_the_week_blocks_it(client, company, carrier):
    client.put(f'/api/carrier-companies/{company.id}/availability/weekly', json={'weekly': ['day'] * 7},
               headers=carrier)
    day = _day(3)

    res = client.put(f'/api/carrier-companies/{company.id}/availability/days/{day}', json={'blocked': None},
                     headers=carrier)

    assert res.get_json() == {'date': day.isoformat(), 'blocked': None, 'source': 'day'}
    assert _calendar(client, company, carrier, day, day)[day.isoformat()]['blocked'] is None


def test_blocking_half_a_day_and_going_back_to_the_week(client, company, carrier):
    day = _day(2)
    url = f'/api/carrier-companies/{company.id}/availability/days/{day}'

    client.put(url, json={'blocked': 'pm'}, headers=carrier)
    assert _calendar(client, company, carrier, day, day)[day.isoformat()]['blocked'] == 'pm'

    client.put(url, json={'reset': True}, headers=carrier)
    assert _calendar(client, company, carrier, day, day)[day.isoformat()]['blocked'] is None
    assert CarrierAvailability.query.count() == 0


def test_a_day_that_says_the_same_as_the_week_is_not_stored(client, company, carrier):
    client.put(f'/api/carrier-companies/{company.id}/availability/weekly', json={'weekly': ['day'] * 7},
               headers=carrier)

    client.put(f'/api/carrier-companies/{company.id}/availability/days/{_day(1)}', json={'blocked': 'day'},
               headers=carrier)

    assert CarrierAvailability.query.filter(CarrierAvailability.day.isnot(None)).count() == 0


@pytest.mark.parametrize('body', [{'blocked': 'night'}, {}, {'blocked': 1}])
def test_a_day_needs_a_valid_part(client, company, carrier, body):
    res = client.put(f'/api/carrier-companies/{company.id}/availability/days/{_day(1)}', json=body,
                     headers=carrier)

    assert res.status_code == 400


def test_days_that_passed_cannot_be_changed(client, company, carrier):
    res = client.put(f'/api/carrier-companies/{company.id}/availability/days/{_day(-1)}',
                     json={'blocked': 'day'}, headers=carrier)

    assert res.status_code == 400


def test_the_week_needs_seven_values(client, company, carrier):
    res = client.put(f'/api/carrier-companies/{company.id}/availability/weekly',
                     json={'weekly': ['day'] * 6}, headers=carrier)

    assert res.status_code == 400


def test_a_move_it_already_has_shows_on_its_day(client, company, carrier):
    order = make_order(days_ahead=4, order_status_id=2,
                       appointment_date=datetime.combine(_day(4), datetime.min.time()).replace(hour=15))
    db.session.add(Quotation(order_id=order.id, carrier_company_id=company.id, amount=300, quotation_status_id=2))
    db.session.commit()

    day = _calendar(client, company, carrier, _day(4), _day(4))[_day(4).isoformat()]

    assert day['booked'] == [{'order_id': order.id, 'part': 'pm'}]


def test_a_company_cannot_see_another_ones_calendar(client, catalog, carrier):
    other = make_company('Otra SAC', 'moving')

    assert client.get(f'/api/carrier-companies/{other.id}/availability', headers=carrier).status_code == 403
    assert client.put(f'/api/carrier-companies/{other.id}/availability/days/{_day(1)}',
                      json={'blocked': 'day'}, headers=carrier).status_code == 403


def test_the_calendar_range_is_limited(client, company, carrier):
    res = client.get(f'/api/carrier-companies/{company.id}/availability?from={_day(0)}&to={_day(90)}',
                     headers=carrier)

    assert res.status_code == 400


# ── Recordatorios ──

def _at(days_ahead, hour):
    return datetime.combine(_day(days_ahead), datetime.min.time()).replace(hour=hour)


def test_the_reminder_skips_days_the_company_cannot_work(client, company, superadmin):
    blocked = make_order(appointment_date=_at(3, 10))
    afternoon = make_order(appointment_date=_at(5, 15))
    free = make_order(appointment_date=_at(5, 9))
    db.session.add_all([
        CarrierAvailability(carrier_company_id=company.id, day=_day(3), blocked='day'),
        CarrierAvailability(carrier_company_id=company.id, day=_day(5), blocked='pm'),
    ])
    db.session.commit()

    pending = [o['id'] for o in reminders(client, superadmin)['Mudanzas SAC']['orders']]

    assert free.id in pending
    assert blocked.id not in pending and afternoon.id not in pending


def test_the_reminder_skips_days_the_company_already_has_full(client, catalog, company, superadmin):
    other = make_company('Otra SAC', 'moving')
    taken = make_order(order_status_id=2, appointment_date=_at(4, 9))
    db.session.add(Quotation(order_id=taken.id, carrier_company_id=company.id, amount=300, quotation_status_id=2))
    db.session.commit()
    same_day = make_order(appointment_date=_at(4, 15))

    companies = reminders(client, superadmin)

    assert 'Mudanzas SAC' not in companies
    assert [o['id'] for o in companies['Otra SAC']['orders']] == [same_day.id]

    db.session.add(CarrierRates(carrier_company_id=company.id, moves_per_day=2))
    db.session.commit()
    assert [o['id'] for o in reminders(client, superadmin)['Mudanzas SAC']['orders']] == [same_day.id]
