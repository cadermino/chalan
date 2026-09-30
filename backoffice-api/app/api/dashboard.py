"""Números del dashboard del backoffice, uno por rol.

Cubre lo que pasa después de que la orden existe —cotizaciones, adjudicación,
pagos, mudanza—, que es lo que GA4 no ve. El camino visita → orden creada ya
se mide allá.

Las órdenes canceladas cuentan: una orden que se cayó es parte del embudo, y
esconderla haría ver mejores las tasas. Solo quedan fuera donde el número no
tiene sentido para ellas —un adelanto pendiente de una orden cancelada no es
plata por cobrar—. Las órdenes de prueba se borran de la base, no se filtran
acá.

Fechas: `created_date` (órdenes, cotizaciones) es UTC naive y
`appointment_date` es hora de Lima naive (ver `_iso_local` en models), así que
cada una se compara contra su propio "ahora".
"""
from datetime import datetime, timedelta, timezone

from flask import jsonify, g, request

from . import api
from .decorators import login_required
from .orders import _financial_breakdown, QUOTATION_STATUS_SELECTED
from ..models import (
    Order, Quotation, Payment, ReferredOrder, Customer, CarrierCompany,
    ROLE_CARRIER, ROLE_SUPERADMIN, ROLE_ADMIN, _iso, _iso_local,
)
from .. import db

STATUS_PENDING = 1
STATUS_IN_PROGRESS = 2
STATUS_COMPLETED = 3
STATUS_CANCELLED = 4

PERIOD_OPTIONS = (7, 30, 90)
DEFAULT_PERIOD = 30
LIST_LIMIT = 8
LIMA_OFFSET = timedelta(hours=-5)


def _now_utc():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _now_lima():
    return _now_utc() + LIMA_OFFSET


def _period_bounds():
    """(inicio, fin, inicio_anterior, días). El período anterior tiene el mismo
    largo e inmediatamente antes, para comparar peras con peras."""
    try:
        days = int(request.args.get('days', DEFAULT_PERIOD))
    except (TypeError, ValueError):
        days = DEFAULT_PERIOD
    if days not in PERIOD_OPTIONS:
        days = DEFAULT_PERIOD
    end = _now_utc()
    start = end - timedelta(days=days)
    return start, end, start - timedelta(days=days), days


def _created_between(start, end):
    return Order.query.filter(Order.created_date >= start, Order.created_date < end)


def _has_quotation():
    return db.exists().where(Quotation.order_id == Order.id)


def _has_selected_quotation():
    return db.exists().where(
        Quotation.order_id == Order.id,
        Quotation.quotation_status_id == QUOTATION_STATUS_SELECTED,
    )


def _live_reservation(status=None):
    clauses = [
        Payment.order_id == Order.id,
        Payment.concept == 'reservation',
        Payment.status != 'cancelled',
    ]
    if status:
        clauses.append(Payment.status == status)
    return db.exists().where(*clauses)


def _median_hours(query):
    """Mediana en horas de una consulta que devuelve intervalos. La mediana y no
    el promedio: una sola orden que tardó dos semanas en recibir precio
    arrastraría el promedio y escondería lo que le pasa a la orden típica."""
    seconds = query.scalar()
    return round(seconds / 3600, 1) if seconds is not None else None


def _response_seconds(interval):
    return db.func.percentile_cont(0.5).within_group(db.func.extract('epoch', interval))


def _order_item(order, **extra):
    customer = db.session.get(Customer, order.customer_id) if order.customer_id else None
    return {
        'id': order.id,
        'created_date': _iso(order.created_date),
        'appointment_date': _iso_local(order.appointment_date),
        'customer_name': ' '.join(filter(None, [customer.name, customer.paternal_last_name]))
        if customer else None,
        'phone': (customer.mobile_phone if customer else None) or order.lead_phone,
        **extra,
    }


def _attention_list(query, order_by, item=_order_item):
    return {
        'total': query.count(),
        'items': [item(o) for o in query.order_by(*order_by).limit(LIST_LIMIT).all()],
    }


# ---------------------------------------------------------------- admin

def _funnel(start, end):
    """Cohorte de órdenes creadas en el período y hasta dónde llegó cada una.
    Se mide por cohorte y no por eventos del período porque no hay fecha de
    adjudicación: lo único fechado con certeza es la creación."""
    base = _created_between(start, end)
    return {
        'created': base.count(),
        'quoted': base.filter(_has_quotation()).count(),
        'awarded': base.filter(Order.order_status_id.in_([STATUS_IN_PROGRESS, STATUS_COMPLETED])).count(),
        'completed': base.filter(Order.order_status_id == STATUS_COMPLETED).count(),
        'cancelled': base.filter(Order.order_status_id == STATUS_CANCELLED).count(),
    }


def _supply(start, end):
    orders = _created_between(start, end)
    order_ids = orders.with_entities(Order.id)
    created = orders.count()
    quotes = Quotation.query.filter(Quotation.order_id.in_(order_ids)).count()

    first_quote = db.session.query(
        Quotation.order_id, db.func.min(Quotation.created_date).label('first_at'),
    ).group_by(Quotation.order_id).subquery()
    median_first = _median_hours(
        db.session.query(_response_seconds(first_quote.c.first_at - Order.created_date))
        .join(first_quote, first_quote.c.order_id == Order.id)
        .filter(Order.id.in_(order_ids))
    )

    return {
        'active_carriers': CarrierCompany.query.filter_by(active=1).count(),
        'quoting_carriers': db.session.query(
            db.func.count(db.distinct(Quotation.carrier_company_id))
        ).filter(Quotation.created_date >= start, Quotation.created_date < end).scalar(),
        'median_first_quote_hours': median_first,
        'quotes_per_order': round(quotes / created, 1) if created else None,
    }


def _money(start, end):
    """Plata de la cohorte adjudicada. Pasa por _financial_breakdown —el mismo
    desglose del detalle de la orden— para que el ingreso de Chalán del
    dashboard y el de cada orden no puedan diferir."""
    awarded = _created_between(start, end).filter(
        Order.order_status_id.in_([STATUS_IN_PROGRESS, STATUS_COMPLETED])
    ).all()
    gmv = platform = 0.0
    counted = 0
    for order in awarded:
        breakdown = _financial_breakdown(order)
        if breakdown is None:
            continue
        counted += 1
        gmv += breakdown['total_amount']
        platform += breakdown['platform_gross']
    return {
        'gmv': round(gmv, 2),
        'platform_income': round(platform, 2),
        'avg_ticket': round(gmv / counted, 2) if counted else None,
    }


def _deposits(start, end):
    """Estado actual de los adelantos, no de la cohorte: lo pendiente es plata
    por cobrar hoy, sin importar cuándo se creó la orden. Lo pendiente de una
    orden cancelada no se va a cobrar, así que no suma; lo cobrado sí, aunque
    la orden se haya caído después: la plata entró."""
    reservations = Payment.query.join(Order, Order.id == Payment.order_id).filter(
        Payment.concept == 'reservation',
    )
    pending = reservations.filter(
        Payment.status == 'pending', Order.order_status_id != STATUS_CANCELLED,
    )
    paid = reservations.filter(
        Payment.status == 'paid', Payment.paid_at >= start, Payment.paid_at < end,
    )
    total = lambda q: round(q.with_entities(db.func.coalesce(db.func.sum(Payment.amount), 0)).scalar(), 2)
    return {
        'pending_count': pending.count(),
        'pending_amount': total(pending),
        'paid_count': paid.count(),
        'paid_amount': total(paid),
        'unregistered_count': _unregistered().count(),
    }


def _unregistered():
    return Order.query.filter(
        Order.order_status_id == STATUS_IN_PROGRESS,
        _has_selected_quotation(),
        ~_live_reservation(),
    )


def _agent_commissions():
    # Mismo criterio que el saldo que ve cada agente en referred-orders: las
    # comisiones de órdenes que todavía no se completaron ni cancelaron.
    row = db.session.query(
        db.func.count(ReferredOrder.id),
        db.func.coalesce(db.func.sum(ReferredOrder.commission), 0),
    ).join(Order, Order.id == ReferredOrder.order_id).filter(
        Order.order_status_id.notin_([STATUS_COMPLETED, STATUS_CANCELLED]),
        ReferredOrder.commission.isnot(None),
    ).one()
    return {'count': row[0], 'amount': round(float(row[1]), 2)}


def _reservation_item(order):
    reservation = Payment.query.filter(
        Payment.order_id == order.id,
        Payment.concept == 'reservation',
        Payment.status != 'cancelled',
    ).order_by(Payment.id.desc()).first()
    return _order_item(order, amount=reservation.amount if reservation else None)


def _attention():
    now = _now_utc()
    lima_now = _now_lima()
    return {
        # Más de una hora sin ningún precio. El cliente de una mudanza suele
        # pedir precio a varios lados a la vez: si en la primera hora no le
        # llegó nada, lo más probable es que cierre con otro. Las más recientes
        # van primero porque son las que todavía se salvan empujando a los
        # transportistas; pasada la semana ya no se cuentan acá.
        'cooling': _attention_list(
            Order.query.filter(
                Order.order_status_id == STATUS_PENDING,
                Order.created_date < now - timedelta(hours=1),
                Order.created_date >= now - timedelta(days=7),
                ~_has_quotation(),
            ),
            [Order.created_date.desc()],
        ),
        'unregistered': _attention_list(
            _unregistered(), [Order.appointment_date.asc().nullslast()],
        ),
        'upcoming_unpaid': _attention_list(
            Order.query.filter(
                Order.order_status_id == STATUS_IN_PROGRESS,
                Order.appointment_date >= lima_now,
                Order.appointment_date < lima_now + timedelta(days=7),
                _live_reservation('pending'),
            ),
            [Order.appointment_date.asc()],
            item=_reservation_item,
        ),
        'leads': _attention_list(
            Order.query.filter(
                Order.order_status_id == STATUS_PENDING,
                Order.customer_id.is_(None),
                db.func.coalesce(Order.lead_phone, '') != '',
                Order.created_date >= now - timedelta(days=7),
            ),
            [Order.created_date.desc()],
        ),
        # Pendientes de más de una semana: casi seguro muertas. Solo el número,
        # para que se limpien en bloque desde la lista de órdenes.
        'stale_pending': Order.query.filter(
            Order.order_status_id == STATUS_PENDING,
            Order.created_date < now - timedelta(days=7),
        ).count(),
    }


def _admin_dashboard():
    start, end, prev_start, days = _period_bounds()
    return {
        'role': 'admin',
        'days': days,
        'attention': _attention(),
        'funnel': {'current': _funnel(start, end), 'previous': _funnel(prev_start, start)},
        'supply': {'current': _supply(start, end), 'previous': _supply(prev_start, start)},
        'money': {'current': _money(start, end), 'previous': _money(prev_start, start)},
        'deposits': _deposits(start, end),
        'agent_commissions': _agent_commissions(),
    }


# ---------------------------------------------------------------- carrier

def _carrier_performance(company_id, start, end):
    own = Quotation.query.filter(
        Quotation.carrier_company_id == company_id,
        Quotation.created_date >= start,
        Quotation.created_date < end,
    )
    sent = own.count()
    won = own.filter(Quotation.quotation_status_id == QUOTATION_STATUS_SELECTED).count()

    def median_response(*filters):
        return _median_hours(
            db.session.query(_response_seconds(Quotation.created_date - Order.created_date))
            .join(Order, Order.id == Quotation.order_id)
            .filter(
                Quotation.created_date >= start,
                Quotation.created_date < end,
                *filters,
            )
        )

    return {
        'sent': sent,
        'won': won,
        'win_rate': round(won / sent, 3) if sent else None,
        'response_hours': median_response(Quotation.carrier_company_id == company_id),
        # El mercado entero, esta empresa incluida. Solo tiempos, nunca
        # precios: el precio de la competencia no se muestra.
        'market_response_hours': median_response(),
    }


def _carrier_dashboard(company_id):
    start, end, prev_start, days = _period_bounds()
    now = _now_utc()
    lima_now = _now_lima()

    quoted_by_me = db.exists().where(
        Quotation.order_id == Order.id,
        Quotation.carrier_company_id == company_id,
    )
    # Una pendiente con la fecha de mudanza ya pasada no es oportunidad.
    open_orders = Order.query.filter(
        Order.order_status_id == STATUS_PENDING,
        ~quoted_by_me,
        db.or_(Order.appointment_date.is_(None), Order.appointment_date >= lima_now),
    )
    opportunities = {
        'total': open_orders.count(),
        'new_this_week': open_orders.filter(Order.created_date >= now - timedelta(days=7)).count(),
        # Sin datos del cliente: el transportista no los ve hasta ganar.
        'items': [
            {
                'id': o.id,
                'created_date': _iso(o.created_date),
                'appointment_date': _iso_local(o.appointment_date),
            }
            for o in open_orders.order_by(
                Order.appointment_date.asc().nullslast(), Order.created_date.desc(),
            ).limit(LIST_LIMIT).all()
        ],
    }

    jobs = db.session.query(Order, Quotation).join(
        Quotation, Quotation.order_id == Order.id,
    ).filter(
        Quotation.carrier_company_id == company_id,
        Quotation.quotation_status_id == QUOTATION_STATUS_SELECTED,
        Order.order_status_id == STATUS_IN_PROGRESS,
        db.or_(
            Order.appointment_date.is_(None),
            Order.appointment_date >= lima_now - timedelta(days=1),
        ),
    ).order_by(Order.appointment_date.asc().nullslast())
    job_rows = jobs.all()
    upcoming = {
        'total': len(job_rows),
        'amount': round(sum(q.amount or 0 for _, q in job_rows), 2),
        'items': [
            {
                'id': o.id,
                'appointment_date': _iso_local(o.appointment_date),
                'amount': q.amount,
            }
            for o, q in job_rows[:LIST_LIMIT]
        ],
    }

    # `reviews` no tiene modelo en este API: la escribe solo el API principal.
    rating = db.session.execute(
        db.text('SELECT AVG(rating), COUNT(*) FROM reviews WHERE carrier_company_id = :id'),
        {'id': company_id},
    ).one()

    return {
        'role': 'carrier',
        'days': days,
        'opportunities': opportunities,
        'performance': {
            'current': _carrier_performance(company_id, start, end),
            'previous': _carrier_performance(company_id, prev_start, start),
        },
        'upcoming': upcoming,
        'rating': {
            'average': round(float(rating[0]), 1) if rating[0] is not None else None,
            'count': rating[1],
        },
    }


@api.route('/dashboard', methods=['GET'])
@login_required
def dashboard():
    user = g.current_user
    if user.role in (ROLE_SUPERADMIN, ROLE_ADMIN):
        return jsonify(_admin_dashboard()), 200
    if user.role == ROLE_CARRIER and user.carrier_company_id:
        return jsonify(_carrier_dashboard(user.carrier_company_id)), 200
    return jsonify({'message': 'forbidden'}), 403
