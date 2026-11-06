"""Lo que cada transportista habría cotizado con sus tarifas, en silencio.

El plan es cotizar a nombre de quien no contestó una orden en 20 minutos. Antes,
dos semanas sin mostrárselo a nadie: a los 20 minutos de avisada una orden,
`run()` (comando `flask auto-quote`, que un cron del servidor corre seguido)
calcula lo que cobraría cada empresa con tarifas y lo guarda en
`auto_quote_estimates`. El backoffice lo pone al lado de lo que la empresa cotizó
de verdad, para ver cuánto acierta cada una antes de encenderla.

Por ahora solo mudanzas y "cosas" dentro de Lima: la carga se cobra por peso,
los vehículos aparte, y fuera de Lima manda la distancia, que todavía es en
línea recta. Se calcula para toda empresa con tarifas, haya contestado o no y
haya autorizado o no: es lo que permite comparar. Una empresa que no puede ese
día (calendario o día lleno), que no carga tanto o no va tan lejos, o que
rechazó la orden, queda con `skip_reason`.
"""
import math
import re
import unicodedata
from datetime import datetime, timedelta

from sqlalchemy import or_

from .. import db
from ..models import (AutoQuoteEstimate, CarrierAvailability, CarrierRates, Order, OrderCarrierDecline,
                      Quotations)
from .order.volume import estimate_volume
from .rates_formula import blocked_on, estimate, is_available, rates_complete

WAIT = timedelta(minutes=20)
# Una orden avisada hace más que esto ya no se mira: al encender el cron no se
# calculan las de semanas atrás.
LOOKBACK = timedelta(days=2)
ROAD_FACTOR = 1.35
LOAD_TYPES = (None, 'moving', 'items')
ORDER_PENDING = 1
ORDER_CANCELLED = 4
QUOTATION_SELECTED = 2

# Lima Metropolitana y Callao. Una orden con coordenadas se ubica por ellas
# (desde la migración 029); sin coordenadas, por el distrito en el texto.
LIMA_BOUNDS = ((-12.55, -11.70), (-77.20, -76.65))
LIMA_DISTRICTS = (
    'lima', 'callao', 'lince', 'jesus maria', 'pueblo libre', 'magdalena', 'san miguel', 'san isidro', 'miraflores',
    'barranco', 'surquillo', 'san borja', 'surco', 'la molina', 'ate', 'santa anita', 'el agustino', 'la victoria',
    'brena', 'rimac', 'san martin de porres', 'los olivos', 'independencia', 'comas', 'carabayllo',
    'puente piedra', 'ancon', 'santa rosa', 'san juan de lurigancho', 'lurigancho', 'chaclacayo', 'cieneguilla',
    'san juan de miraflores', 'villa maria del triunfo', 'villa el salvador', 'chorrillos', 'san luis',
    'pachacamac', 'lurin', 'punta hermosa', 'punta negra', 'san bartolo', 'pucusana', 'bellavista', 'la perla',
    'carmen de la legua', 'ventanilla', 'la punta', 'mi peru',
)
# Ciudades de fuera que comparten nombre con un distrito de Lima o lo llevan.
NOT_LIMA = ('huaral', 'huacho', 'canete', 'chancay', 'huancayo', 'arequipa', 'trujillo', 'cusco', 'ica', 'chilca')


def _norm(text):
    text = unicodedata.normalize('NFD', (text or '').lower())
    return ''.join(c for c in text if unicodedata.category(c) != 'Mn')


def in_lima(detail):
    if detail is None:
        return False
    if detail.latitude is not None and detail.longitude is not None:
        (lat_min, lat_max), (lng_min, lng_max) = LIMA_BOUNDS
        return lat_min <= detail.latitude <= lat_max and lng_min <= detail.longitude <= lng_max
    text = _norm(' '.join(filter(None, [detail.street, detail.neighborhood, detail.city, detail.state])))
    if any(re.search(rf'\b{place}\b', text) for place in NOT_LIMA):
        return False
    return any(re.search(rf'\b{place}\b', text) for place in LIMA_DISTRICTS)


def straight_km(a, b):
    if None in (a.latitude, a.longitude, b.latitude, b.longitude):
        return None
    p1, p2 = math.radians(a.latitude), math.radians(b.latitude)
    dp, dl = p2 - p1, math.radians(b.longitude - a.longitude)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * 6371 * math.asin(math.sqrt(h)) * ROAD_FACTOR, 1)


def floors_on_foot(detail):
    """Pisos que hay que subir o bajar sin ascensor en una dirección."""
    if detail is None or detail.has_elevator:
        return 0
    try:
        return max(int(detail.floor_number or 1) - 1, 0)
    except (TypeError, ValueError):
        return 0


def _scope(order, origin, destination):
    """Por qué la orden no se calcula, o None."""
    if order.load_type not in LOAD_TYPES:
        return 'load_type'
    if order.appointment_date is None:
        return 'no_date'
    if not (in_lima(origin) and in_lima(destination)):
        return 'outside_lima'
    return None


def _rates_dict(rates):
    return {field: getattr(rates, field) for field in (
        'base_fee', 'per_m3', 'per_loader', 'per_floor', 'minimum_fare', 'per_km_outside_lima',
        'weekend_surcharge_percent')}


def _company_ids():
    # La misma lista que recibe el aviso de una orden nueva.
    from .orders import get_carrier_companies
    return [c['id'] for c in get_carrier_companies()]


def _taken(company_id, order):
    """Mudanzas que la empresa ya tiene ese día (sin contar esta)."""
    day = order.appointment_date.date()
    start = datetime.combine(day, datetime.min.time())
    rows = (
        db.session.query(Order.id)
        .join(Quotations, Quotations.order_id == Order.id)
        .filter(Quotations.carrier_company_id == company_id,
                Quotations.quotation_status_id == QUOTATION_SELECTED,
                Order.order_status_id != ORDER_CANCELLED,
                Order.id != order.id,
                Order.appointment_date >= start,
                Order.appointment_date < start + timedelta(days=1))
        .all()
    )
    return rows


def _blocked(company_id, day):
    rows = CarrierAvailability.query.filter(
        CarrierAvailability.carrier_company_id == company_id,
        CarrierAvailability.vehicle_id.is_(None),
        or_(CarrierAvailability.weekday == day.weekday(), CarrierAvailability.day == day),
    ).all()
    weekly = {r.weekday: r.blocked for r in rows if r.weekday is not None}
    days = {r.day: r for r in rows if r.day is not None}
    return blocked_on(weekly, days, day)[0]


def check_order(order, now):
    details = list(order.order_details)
    origin = next((d for d in details if d.type == 'carry_from'), None)
    destination = next((d for d in details if d.type == 'deliver_to'), None)

    volume = estimate_volume(order.comments)
    order.estimated_volume_m3 = volume['m3']
    order.volume_breakdown = volume
    skip = _scope(order, origin, destination)
    if skip is None and volume['m3'] <= 0:
        skip = 'no_items'

    rates_by_company = {}
    if skip is None:
        company_ids = _company_ids()
        for rates in CarrierRates.query.filter(CarrierRates.carrier_company_id.in_(company_ids),
                                               CarrierRates.vehicle_id.is_(None)).all():
            if rates_complete(_rates_dict(rates)):
                rates_by_company[rates.carrier_company_id] = rates
        if not rates_by_company:
            skip = 'no_rates'

    if skip is None:
        declined = {d.carrier_company_id for d in OrderCarrierDecline.query.filter_by(order_id=order.id)}
        move = {
            'm3': volume['m3'],
            'km': straight_km(origin, destination) or 0,
            'floors': floors_on_foot(origin) + floors_on_foot(destination),
            'loaders': order.loaders_quantity or 0,
            'weekend': order.appointment_date.weekday() >= 5,
            'outside_lima': False,
        }
        for company_id, rates in rates_by_company.items():
            reason, result = None, None
            if company_id in declined:
                reason = 'declined'
            elif not is_available(_blocked(company_id, order.appointment_date.date()), _taken(company_id, order),
                                  rates.moves_per_day, order.appointment_date):
                reason = 'unavailable'
            elif rates.max_m3 is not None and move['m3'] > float(rates.max_m3):
                reason = 'too_big'
            elif rates.max_km is not None and move['km'] > rates.max_km:
                reason = 'too_far'
            else:
                result = estimate(_rates_dict(rates), **move)
            db.session.add(AutoQuoteEstimate(
                order_id=order.id, carrier_company_id=company_id, notified_at=order.carrier_notified_at,
                amount=result['total'] if result else None, skip_reason=reason,
                inputs=move, lines=result['lines'] if result else None,
            ))

    order.auto_quote_skip = skip
    order.auto_quote_checked_at = now
    db.session.commit()
    return skip


def pending_orders(now):
    return Order.query.filter(
        Order.order_status_id == ORDER_PENDING,
        Order.quotation_requested.is_(True),
        Order.customer_id.isnot(None),
        Order.carrier_notified_at.isnot(None),
        Order.carrier_notified_at <= now - WAIT,
        Order.carrier_notified_at >= now - LOOKBACK,
        or_(Order.auto_quote_checked_at.is_(None), Order.auto_quote_checked_at < Order.carrier_notified_at),
    ).order_by(Order.carrier_notified_at).all()


def run(now=None):
    """Mira las órdenes avisadas hace 20 minutos o más que no miró desde su
    último aviso. Devuelve {order_id: motivo o None}."""
    now = now or datetime.utcnow()
    return {order.id: check_order(order, now) for order in pending_orders(now)}
