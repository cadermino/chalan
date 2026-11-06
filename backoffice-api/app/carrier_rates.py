"""Tarifas y disponibilidad de las empresas (migración 047).

Es lo que hace falta para cotizar una mudanza a nombre de un transportista que
no contestó en 20 minutos. Por ahora el backoffice lo usa para el simulador de
"Tarifas", el calendario de "Disponibilidad" y para no recordarle a una empresa
órdenes de días que no puede.

La fórmula y las partes del día están en `rates_formula.py`, que el API
principal copia.
"""
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

from . import db
from .rates_formula import BLOCKED_PARTS, blocked_on, estimate, is_available, part_of, rates_complete  # noqa: F401
from .models import CarrierAvailability, CarrierRates, Order, Quotation

QUOTATION_STATUS_SELECTED = 2
ORDER_STATUS_CANCELLED = 4

# Campo: (mínimo, máximo, entero). Los máximos frenan un precio en céntimos o
# una tarifa total escrita donde va la tarifa por unidad.
RATE_FIELDS = {
    'base_fee': (0, 20000, False),
    'per_m3': (0, 1000, False),
    'per_loader': (0, 1000, False),
    'per_floor': (0, 1000, False),
    'minimum_fare': (0, 20000, False),
    'per_km_outside_lima': (0, 100, False),
    'weekend_surcharge_percent': (0, 100, False),
    'max_m3': (0, 200, False),
    'max_km': (0, 5000, True),
    'moves_per_day': (1, 20, True),
}


def parse_rate(field, value):
    """El valor ya validado, o ValueError con el motivo. Vacío es None."""
    low, high, integer = RATE_FIELDS[field]
    if value is None or value == '':
        if field == 'moves_per_day':
            raise ValueError(f'{field} is required')
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise ValueError(f'{field} must be a number')
    try:
        number = Decimal(str(value).strip().replace(',', '.'))
    except ArithmeticError:
        raise ValueError(f'{field} must be a number')
    if not number.is_finite() or number < low or number > high:
        raise ValueError(f'{field} must be between {low} and {high}')
    if integer:
        if number != number.to_integral_value():
            raise ValueError(f'{field} must be a whole number')
        return int(number)
    return number.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def company_rates(company_id):
    return CarrierRates.query.filter_by(carrier_company_id=company_id, vehicle_id=None).first()


def moves_per_day(company_id):
    rates = company_rates(company_id)
    return rates.moves_per_day if rates else 1


def booked_moves(company_ids, start, end):
    """Mudanzas que ya tiene cada empresa entre `start` y `end` (fechas, inclusive):
    las de una cotización suya elegida en una orden que no se canceló. Elegida
    con el yapeo en revisión también cuenta: ese día ya está tomado."""
    if not company_ids:
        return {}
    rows = (
        db.session.query(Quotation.carrier_company_id, Order.id, Order.appointment_date)
        .join(Order, Order.id == Quotation.order_id)
        .filter(Quotation.carrier_company_id.in_(company_ids),
                Quotation.quotation_status_id == QUOTATION_STATUS_SELECTED,
                Order.order_status_id != ORDER_STATUS_CANCELLED,
                Order.appointment_date >= datetime.combine(start, datetime.min.time()),
                Order.appointment_date < datetime.combine(end + timedelta(days=1), datetime.min.time()))
        .order_by(Order.appointment_date)
        .all()
    )
    result = {}
    for company_id, order_id, when in rows:
        result.setdefault(company_id, []).append({
            'date': when.date().isoformat(), 'order_id': order_id, 'part': part_of(when),
        })
    return result


def availability_rules(company_ids):
    """La semana y los días marcados de cada empresa: ({id: {weekday: blocked}},
    {id: {date: row}})."""
    weekly, days = {}, {}
    if not company_ids:
        return weekly, days
    rows = CarrierAvailability.query.filter(
        CarrierAvailability.carrier_company_id.in_(company_ids),
        CarrierAvailability.vehicle_id.is_(None),
    ).all()
    for row in rows:
        if row.weekday is not None:
            weekly.setdefault(row.carrier_company_id, {})[row.weekday] = row.blocked
        else:
            days.setdefault(row.carrier_company_id, {})[row.day] = row
    return weekly, days


def unavailable_pairs(company_ids, orders):
    """Las (orden, empresa) que caen en un día u hora que la empresa no puede o
    que ya tiene lleno, para no pedirle cotizar esas."""
    dated = [o for o in orders if o.appointment_date]
    if not dated or not company_ids:
        return set()
    start = min(o.appointment_date for o in dated).date()
    end = max(o.appointment_date for o in dated).date()
    weekly, days = availability_rules(company_ids)
    booked = booked_moves(company_ids, start, end)
    capacity = dict(
        db.session.query(CarrierRates.carrier_company_id, CarrierRates.moves_per_day)
        .filter(CarrierRates.carrier_company_id.in_(company_ids), CarrierRates.vehicle_id.is_(None))
        .all()
    )
    result = set()
    for company_id in company_ids:
        for order in dated:
            day = order.appointment_date.date()
            blocked, _ = blocked_on(weekly.get(company_id, {}), days.get(company_id, {}), day)
            taken = [b for b in booked.get(company_id, [])
                     if b['date'] == day.isoformat() and b['order_id'] != order.id]
            if not is_available(blocked, taken, capacity.get(company_id, 1), order.appointment_date):
                result.add((order.id, company_id))
    return result


def lima_today():
    # appointment_date se guarda con la hora de Lima, sin zona.
    return (datetime.utcnow() - timedelta(hours=5)).date()

