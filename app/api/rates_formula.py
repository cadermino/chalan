"""La fórmula de una mudanza con las tarifas de una empresa, y qué parte del
día puede trabajar. Sin base de datos ni Flask a propósito: es copia de la del
backoffice-api (`backoffice-api/app/rates_formula.py`, la del simulador de
"Tarifas"), y `tests/test_auto_quote.py` compara las dos. Cambiar las dos
juntas.

En Lima el precio sigue a lo que se lleva, no a la distancia (367 cotizaciones
de producción, noviembre de 2026): una base, más un precio por m³, por cargador
y por piso sin ascensor; fuera de Lima se suman los km. El recargo de fin de
semana va sobre todo eso, y la tarifa mínima es el piso. Es el precio de la
empresa (la comisión va encima) redondeado a soles, porque `quotations.amount`
es entero.
"""
from decimal import Decimal, ROUND_HALF_UP


BLOCKED_PARTS = ('day', 'am', 'pm')
# Las mudanzas son de 7 am a 6 pm, a la hora en punto: la tarde empieza a la 1.
AFTERNOON_FROM_HOUR = 13


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
