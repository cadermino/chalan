"""Lo que cada transportista habría cotizado con sus tarifas, en silencio.

Lo que se prueba es lo que haría medir mal a una empresa (y después cotizar mal
por ella): un m³ que no sale de la lista, una orden fuera de alcance que se
calcula igual, un día que la empresa no puede y se calcula como si pudiera, una
orden que se calcula dos veces o que no se recalcula cuando el cliente la
cambia, y que la fórmula del API no sea la del simulador del backoffice.
"""
import importlib.util
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from app import db
from app.api import rates_formula
from app.api.auto_quote import check_order, in_lima, run
from app.api.order.volume import estimate_volume
from app.models import (AutoQuoteEstimate, CarrierAvailability, CarrierCompany, CarrierCompanyServiceType,
                        CarrierRates, Order, OrderCarrierDecline, OrderDetails, Quotations, ServiceType)

NOW = datetime(2026, 11, 10, 15, 0)
RATES = {'base_fee': 200, 'per_m3': 15, 'per_loader': 60, 'per_floor': 20, 'minimum_fare': 250,
         'weekend_surcharge_percent': 10}
LIST = '1 refrigeradora\n2 roperos\n10 cajas'   # (1 + 2.4 + 0.7) × 1.25 = 5.1 m³


# ── m³ de la lista ──

def test_the_volume_comes_from_the_list_with_quantities():
    result = estimate_volume('1 refrigeradora\n2 roperos\n10 cajas medianas')

    assert [(i['key'], i['qty']) for i in result['items']] == [('refrigeradora', 1), ('ropero', 2), ('caja', 10)]
    assert result['m3'] == 5.1
    assert result['unknown'] == []


def test_a_line_with_several_things_is_split():
    result = estimate_volume('Cama 2 plazas, dos sillas y 3 cajas')

    assert [(i['key'], i['qty']) for i in result['items']] == [('cama_2', 1), ('silla', 2), ('caja', 3)]


def test_the_longest_name_wins():
    assert estimate_volume('1 sofá cama')['items'][0]['key'] == 'sofa_cama'
    assert estimate_volume('refrigeradora de 2 puertas')['items'][0]['key'] == 'refrigeradora_grande'


def test_what_has_measures_is_measured():
    result = estimate_volume('Una cocina de 0.85m x 0.50m x 0.50m - Peso aproximado: 40 kg')

    assert result['items'][0]['m3'] == pytest.approx(0.2125, abs=0.001)


def test_a_total_written_by_the_customer_wins():
    assert estimate_volume('28 m3\n1 cama')['m3'] == 28
    assert estimate_volume('28 m3')['stated'] is True


def test_what_is_not_recognized_counts_as_a_thing_and_notes_count_as_nothing():
    result = estimate_volume('1 cono de señalización\nel recojo se hace en dos puntos de san juan de lurigancho')

    assert result['m3'] == round(0.3 * 1.25, 1)
    assert len(result['unknown']) == 2


def test_loose_numbers_and_refusals_are_not_things():
    result = estimate_volume('juego de sofá 3,2,1\nLo siento, no puedo ayudar con eso.\ntest')

    assert [i['key'] for i in result['items']] == ['juego_sala']
    assert result['unknown'] == []


def test_an_empty_list_has_no_volume():
    assert estimate_volume(None)['m3'] == 0
    assert estimate_volume('  \n')['m3'] == 0


# ── Lima ──

def _detail(**fields):
    return OrderDetails(type='carry_from', **fields)


def test_lima_is_read_from_the_coordinates_first():
    assert in_lima(_detail(latitude=-12.12, longitude=-77.03, street='Huancayo'))
    assert not in_lima(_detail(latitude=-12.06, longitude=-75.21, street='Miraflores'))


def test_without_coordinates_lima_is_read_from_the_district():
    assert in_lima(_detail(street='Av. Brasil 1361, Jesús María 15072, Perú'))
    assert not in_lima(_detail(street='Jr. Jorge Chávez 160, Huancayo 12007, Perú'))
    assert not in_lima(_detail(street='Av. Principal Huando, Huaral, Lima'))
    assert not in_lima(None)


# ── El cálculo en silencio ──

@pytest.fixture
def moving(app, monkeypatch):
    monkeypatch.setenv('COUNTRY_ID', '2')
    service = ServiceType(code='moving', name='Mudanzas y fletes')
    db.session.add(service)
    db.session.commit()
    return service


def make_company(moving, name='Mudanzas SAC', rates=RATES, **extra):
    company = CarrierCompany(name=name, active=1, country_id=2)
    db.session.add(company)
    db.session.commit()
    db.session.add(CarrierCompanyServiceType(carrier_company_id=company.id, service_type_id=moving.id))
    if rates is not None:
        db.session.add(CarrierRates(carrier_company_id=company.id, **rates, **extra))
    db.session.commit()
    return company


def make_order(customer, notified=NOW - timedelta(minutes=25), when=datetime(2026, 11, 12, 9), comments=LIST,
               origin=(-12.08, -77.05, 4, 0), destination=(-12.14, -76.99, 1, 0), **fields):
    values = {'order_status_id': 1, 'quotation_requested': True, **fields}
    order = Order(customer_id=customer.id, carrier_notified_at=notified, appointment_date=when, comments=comments,
                  **values)
    db.session.add(order)
    db.session.commit()
    for kind, (lat, lng, floor, elevator) in (('carry_from', origin), ('deliver_to', destination)):
        db.session.add(OrderDetails(order_id=order.id, type=kind, latitude=lat, longitude=lng, floor_number=floor,
                                    has_elevator=elevator, street='Lima'))
    db.session.commit()
    return order


def estimates(order):
    return {e.carrier_company_id: e for e in AutoQuoteEstimate.query.filter_by(order_id=order.id)}


def test_each_company_with_rates_gets_what_it_would_charge(customer, moving):
    company = make_company(moving)
    make_company(moving, name='Sin Tarifas', rates=None)
    order = make_order(customer, loaders_quantity=2)

    assert run(NOW) == {order.id: None}

    [estimate] = estimates(order).values()
    assert estimate.carrier_company_id == company.id
    # 200 + 5.1 × 15 + 2 × 60 + 3 pisos sin ascensor × 20 (4.º piso en el origen) = 456.5
    assert estimate.amount == 457
    assert estimate.inputs['floors'] == 3 and estimate.inputs['weekend'] is False
    assert estimate.notified_at == order.carrier_notified_at
    assert float(order.estimated_volume_m3) == 5.1
    assert order.volume_breakdown['items'][0]['key'] == 'refrigeradora'


def test_it_waits_twenty_minutes_and_skips_old_orders(customer, moving):
    make_company(moving)
    early = make_order(customer, notified=NOW - timedelta(minutes=10))
    old = make_order(customer, notified=NOW - timedelta(days=3))

    assert run(NOW) == {}
    assert not estimates(early) and not estimates(old)


def test_only_orders_still_looking_for_quotes(customer, moving):
    make_company(moving)
    make_order(customer, order_status_id=2)
    make_order(customer, quotation_requested=False)

    assert run(NOW) == {}


def test_an_order_is_looked_at_once_per_notification(customer, moving):
    make_company(moving)
    order = make_order(customer)
    run(NOW)

    assert run(NOW + timedelta(minutes=5)) == {}
    assert AutoQuoteEstimate.query.count() == 1

    # El cliente la cambió y se volvió a avisar: se calcula de nuevo.
    order.carrier_notified_at = NOW + timedelta(minutes=10)
    order.comments = '1 refrigeradora'
    db.session.commit()
    assert run(NOW + timedelta(minutes=31)) == {order.id: None}
    assert AutoQuoteEstimate.query.count() == 2


@pytest.mark.parametrize('fields, reason', [
    ({'load_type': 'cargo'}, 'load_type'),
    ({'load_type': 'vehicle'}, 'load_type'),
    ({'destination': (-12.06, -75.21, 1, 0)}, 'outside_lima'),
    ({'comments': ''}, 'no_items'),
])
def test_orders_out_of_scope_are_not_computed(customer, moving, fields, reason):
    make_company(moving)
    order = make_order(customer, **fields)

    assert run(NOW) == {order.id: reason}
    assert not estimates(order)
    assert order.auto_quote_checked_at == NOW


def test_without_any_company_with_rates_it_says_so(customer, moving):
    make_company(moving, rates=None)
    make_company(moving, name='Media Tarifa', rates={'per_loader': 60})
    order = make_order(customer)

    assert run(NOW) == {order.id: 'no_rates'}


def test_a_company_that_cannot_take_it_is_recorded_with_why(customer, moving):
    declined = make_company(moving, name='Rechazó')
    blocked = make_company(moving, name='Bloqueada')
    full = make_company(moving, name='Llena')
    small = make_company(moving, name='Chica', max_m3=4)
    near = make_company(moving, name='Cerca', max_km=2)
    free = make_company(moving, name='Libre')
    order = make_order(customer)
    db.session.add(OrderCarrierDecline(order_id=order.id, carrier_company_id=declined.id, reason='zone'))
    db.session.add(CarrierAvailability(carrier_company_id=blocked.id, weekday=order.appointment_date.weekday(),
                                       blocked='am'))
    other = make_order(customer, order_status_id=2, when=datetime(2026, 11, 12, 15))
    db.session.add(Quotations(order_id=other.id, carrier_company_id=full.id, amount=300, quotation_status_id=2))
    db.session.commit()

    run(NOW)

    found = estimates(order)
    assert {c.name: found[c.id].skip_reason for c in (declined, blocked, full, small, near, free)} == {
        'Rechazó': 'declined', 'Bloqueada': 'unavailable', 'Llena': 'unavailable', 'Chica': 'too_big',
        'Cerca': 'too_far', 'Libre': None,
    }
    assert found[free.id].amount is not None and found[small.id].amount is None


def test_a_day_opened_for_that_date_wins_over_the_week(customer, moving):
    company = make_company(moving)
    order = make_order(customer)
    db.session.add_all([
        CarrierAvailability(carrier_company_id=company.id, weekday=order.appointment_date.weekday(), blocked='day'),
        CarrierAvailability(carrier_company_id=company.id, day=order.appointment_date.date(), blocked=None),
    ])
    db.session.commit()

    run(NOW)

    assert estimates(order)[company.id].skip_reason is None


def test_weekends_carry_the_surcharge(customer, moving):
    company = make_company(moving)
    order = make_order(customer, when=datetime(2026, 11, 14, 9), comments='28 m3')   # sábado

    check_order(order, NOW)

    # (200 + 28 × 15 + 3 pisos × 20) × 1.10
    assert estimates(order)[company.id].amount == round((200 + 420 + 60) * 1.1)


def test_customers_and_carriers_do_not_see_what_was_computed(customer, moving):
    from app.api.order.order import Order as OrderEntity
    make_company(moving)
    order = make_order(customer)
    run(NOW)

    details = OrderEntity(order.id).details()

    assert float(order.estimated_volume_m3) > 0
    assert not {'estimated_volume_m3', 'volume_breakdown', 'auto_quote_checked_at', 'auto_quote_skip'} & set(details)


# ── La misma fórmula que el simulador del backoffice ──

def test_the_formula_is_the_same_as_the_backoffice_one():
    path = Path(__file__).resolve().parents[1] / 'backoffice-api' / 'app' / 'rates_formula.py'
    if not path.exists():
        pytest.skip('backoffice-api is not mounted in this container')
    spec = importlib.util.spec_from_file_location('backoffice_rates_formula', path)
    backoffice = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(backoffice)

    for rates in (RATES, {**RATES, 'minimum_fare': None, 'per_km_outside_lima': 4.5}, {'base_fee': 100}):
        for move in ({'m3': 12, 'floors': 3, 'loaders': 2}, {'m3': 1}, {'m3': 7.3, 'weekend': True},
                     {'m3': 12, 'km': 300, 'outside_lima': True}):
            assert rates_formula.estimate(rates, **move) == backoffice.estimate(rates, **move)
    assert Path(rates_formula.__file__).read_text().split('"""', 2)[2] == path.read_text().split('"""', 2)[2]
