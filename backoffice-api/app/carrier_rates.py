"""Tarifas y disponibilidad de las empresas (migración 047).

Es lo que hace falta para cotizar una mudanza a nombre de un transportista que
no contestó en 20 minutos. Por ahora el backoffice lo usa para el simulador de
"Tarifas", el calendario de "Disponibilidad" y para no recordarle a una empresa
órdenes de días que no puede.

Cómo se calcula una mudanza: en Lima el precio sigue a lo que se lleva, no a la
distancia (367 cotizaciones de producción, noviembre de 2026: los km no
explican nada dentro de Lima y el m³ sí). Así que es una base, más un precio por
m³, por cargador y por piso sin ascensor; fuera de Lima se suman los km. El
recargo de fin de semana va sobre todo eso, y la tarifa mínima es el piso. El
resultado es el precio de la empresa: la comisión va encima, como en cualquier
cotización. Se redondea a soles porque `quotations.amount` es entero.
"""
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

from . import db
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

BLOCKED_PARTS = ('day', 'am', 'pm')
# Las mudanzas son de 7 am a 6 pm, a la hora en punto: la tarde empieza a la 1.
AFTERNOON_FROM_HOUR = 13


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


def rates_complete(rates):
    """Sin base ni precio por m³ no hay cómo calcular una mudanza."""
    return rates is not None and rates.get('base_fee') is not None and rates.get('per_m3') is not None


def _d(value):
    return Decimal('0') if value is None else Decimal(str(value))


def estimate(rates, m3, km=0, floors=0, loaders=0, weekend=False, outside_lima=False):
    """El precio de la empresa para una mudanza, con su desglose.

    `rates` es un dict con los campos de RATE_FIELDS (lo guardado o lo que el
    transportista está escribiendo). `floors` son los pisos sin ascensor de las
    dos direcciones sumados. Devuelve None si faltan la base o el precio por m³.
    """
    if not rates_complete(rates):
        return None
    lines = [('Base', _d(rates['base_fee']))]
    lines.append((f'{_fmt(m3)} m³ × S/ {_fmt(rates["per_m3"])}', _d(m3) * _d(rates['per_m3'])))
    if loaders and rates.get('per_loader') is not None:
        lines.append((f'{loaders} cargador{"es" if loaders != 1 else ""}', _d(loaders) * _d(rates['per_loader'])))
    if floors and rates.get('per_floor') is not None:
        lines.append((f'{floors} piso{"s" if floors != 1 else ""} sin ascensor', _d(floors) * _d(rates['per_floor'])))
    if outside_lima and km and rates.get('per_km_outside_lima') is not None:
        lines.append((f'{_fmt(km)} km fuera de Lima', _d(km) * _d(rates['per_km_outside_lima'])))
    subtotal = sum(amount for _, amount in lines)
    if weekend and rates.get('weekend_surcharge_percent'):
        surcharge = subtotal * _d(rates['weekend_surcharge_percent']) / 100
        lines.append((f'Fin de semana (+{_fmt(rates["weekend_surcharge_percent"])}%)', surcharge))
        subtotal += surcharge
    minimum_applied = rates.get('minimum_fare') is not None and subtotal < _d(rates['minimum_fare'])
    total = _d(rates['minimum_fare']) if minimum_applied else subtotal
    return {
        'total': int(total.quantize(Decimal('1'), rounding=ROUND_HALF_UP)),
        'lines': [{'label': label, 'amount': float(amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))}
                  for label, amount in lines],
        'minimum_applied': minimum_applied,
    }


def _fmt(value):
    number = _d(value).normalize()
    return f'{number:f}'


def part_of(when):
    return 'am' if when.hour < AFTERNOON_FROM_HOUR else 'pm'


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


def blocked_on(weekly, days, day):
    """La parte del día que la empresa no puede (`day`, `am`, `pm`) o None, y de
    dónde sale: 'day' si la marcó para esa fecha, 'week' si es su semana."""
    if day in days:
        return days[day].blocked, 'day'
    blocked = weekly.get(day.weekday())
    return blocked, ('week' if blocked else None)


def is_available(blocked, booked_parts, capacity, when):
    """Si la empresa puede hacer una mudanza a la hora `when`."""
    if blocked in ('day', part_of(when)):
        return False
    return len(booked_parts) < capacity


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

