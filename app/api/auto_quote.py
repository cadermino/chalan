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

from flask import current_app
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
# Lo que entra en `orders.estimated_volume_m3`. Una lista con "50000 ladrillos"
# da más, y la base de datos rechazaba la orden entera.
MAX_M3 = 9999
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
        floor = int(detail.floor_number or 1)
    except (TypeError, ValueError):
        return 0
    # El piso 1 está a la calle, y un sótano se sube igual que se baja un piso.
    return -floor if floor < 0 else max(floor - 1, 0)


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


def _ends(order):
    details = list(order.order_details)
    return (next((d for d in details if d.type == 'carry_from'), None),
            next((d for d in details if d.type == 'deliver_to'), None))


def _read_volume(order):
    volume = estimate_volume(order.comments)
    volume['m3'] = min(volume['m3'], MAX_M3)
    order.estimated_volume_m3 = volume['m3']
    order.volume_breakdown = volume
    return volume


def _move(order, origin, destination, m3):
    """Lo que la fórmula necesita de la orden. Se guarda con cada estimación
    (`inputs`): con eso el backoffice recalcula con las tarifas de hoy."""
    return {
        'm3': m3,
        'km': straight_km(origin, destination) or 0,
        'floors': floors_on_foot(origin) + floors_on_foot(destination),
        'loaders': order.loaders_quantity or 0,
        'weekend': order.appointment_date.weekday() >= 5,
        'outside_lima': False,
    }


def _complete_rates(company_ids=None):
    query = CarrierRates.query.filter(CarrierRates.vehicle_id.is_(None))
    if company_ids is not None:
        query = query.filter(CarrierRates.carrier_company_id.in_(company_ids))
    return {rates.carrier_company_id: rates for rates in query.all() if rates_complete(_rates_dict(rates))}


def _add_estimate(order_id, company_id, notified_at, move, rates, reason=None):
    """Una fila por empresa y aviso. Sin tarifas no hay precio, pero la fila
    queda igual (`no_rates`): es lo que deja comparar a la empresa con su
    historial el día que las cargue, o sugerírselas."""
    result = None
    if reason is None and rates is None:
        reason = 'no_rates'
    if reason is None:
        result = estimate(_rates_dict(rates), **move)
    db.session.add(AutoQuoteEstimate(
        order_id=order_id, carrier_company_id=company_id, notified_at=notified_at,
        amount=result['total'] if result else None, skip_reason=reason,
        inputs=move, lines=result['lines'] if result else None,
    ))


def check_order(order, now):
    origin, destination = _ends(order)
    volume = _read_volume(order)
    skip = _scope(order, origin, destination)
    if skip is None and volume['m3'] <= 0:
        skip = 'no_items'

    if skip is None:
        company_ids = _company_ids()
        rates_by_company = _complete_rates(company_ids)
        declined = {d.carrier_company_id for d in OrderCarrierDecline.query.filter_by(order_id=order.id)}
        move = _move(order, origin, destination, volume['m3'])
        for company_id in company_ids:
            rates = rates_by_company.get(company_id)
            reason = None
            if company_id in declined:
                reason = 'declined'
            elif rates is None:
                reason = 'no_rates'
            elif not is_available(_blocked(company_id, order.appointment_date.date()), _taken(company_id, order),
                                  rates.moves_per_day, order.appointment_date):
                reason = 'unavailable'
            elif rates.max_m3 is not None and move['m3'] > float(rates.max_m3):
                reason = 'too_big'
            elif rates.max_km is not None and move['km'] > rates.max_km:
                reason = 'too_far'
            _add_estimate(order.id, company_id, order.carrier_notified_at, move, rates, reason)
        if not rates_by_company:
            skip = 'no_rates'

    order.auto_quote_skip = skip
    order.auto_quote_checked_at = now
    db.session.commit()
    return skip


def backfill(apply=False):
    """Deja comparable lo cotizado antes del cálculo en silencio: una fila por
    cada empresa que cotizó una orden en alcance y no tiene estimación de ese
    aviso. Con eso el backoffice mide el acierto de una empresa contra todo su
    historial, sin esperar órdenes nuevas, y le sugiere tarifas.

    La orden se lee como está hoy (la lista pudo cambiar después de cotizada), y
    no se mira el calendario ni si rechazó: es historia. Devuelve cuántas filas
    faltan, o cuántas agregó con `apply`.
    """
    rates_by_company = _complete_rates()
    quoted, notices = {}, {}
    for order_id, company_id in db.session.query(Quotations.order_id, Quotations.carrier_company_id).distinct():
        quoted.setdefault(order_id, set()).add(company_id)
    for row in AutoQuoteEstimate.query.all():
        notices.setdefault(row.order_id, {}).setdefault(row.notified_at, {})[row.carrier_company_id] = row

    added = 0
    for order in Order.query.filter(Order.id.in_(quoted)).order_by(Order.id).all():
        if order.id in notices:
            # Ya se calculó: faltan las empresas que no recibían la orden o no
            # estaban ese día. La mudanza de cada aviso es la misma para todas.
            missing = [(notified_at, next(iter(rows.values())).inputs, quoted[order.id] - set(rows))
                       for notified_at, rows in notices[order.id].items()]
        else:
            origin, destination = _ends(order)
            if _scope(order, origin, destination) is not None:
                continue
            m3 = min(estimate_volume(order.comments)['m3'], MAX_M3)
            if m3 <= 0:
                continue
            if apply:
                _read_volume(order)
            # Antes de cualquier cotización: todas las de la orden caen en este aviso.
            missing = [(order.created_date, _move(order, origin, destination, m3), quoted[order.id])]
        for notified_at, move, company_ids in missing:
            for company_id in sorted(company_ids):
                added += 1
                if apply:
                    _add_estimate(order.id, company_id, notified_at, move, rates_by_company.get(company_id))
    if apply:
        db.session.commit()
    return added


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
    checked = {}
    for order in pending_orders(now):
        order_id = order.id
        try:
            checked[order_id] = check_order(order, now)
        except Exception:
            # Una orden que falla no deja sin calcular a las que siguen ni vuelve
            # a fallar cada dos minutos: queda marcada y el cron sigue.
            db.session.rollback()
            current_app.logger.exception('auto-quote: la orden %s no se pudo calcular', order_id)
            Order.query.filter_by(id=order_id).update({'auto_quote_skip': 'error', 'auto_quote_checked_at': now})
            db.session.commit()
            checked[order_id] = 'error'
    return checked
