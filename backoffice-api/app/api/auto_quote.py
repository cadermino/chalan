"""Lo que cada empresa habría cotizado con sus tarifas, al lado de lo que cotizó.

El API principal lo calcula en silencio a los 20 minutos de avisada una orden
(api/auto_quote.py allá) y lo guarda en `auto_quote_estimates`. Esto lo muestra a
los admins: por orden, y por empresa cuánto acierta, que es lo que decide a
quién se puede encender la cotización automática.

El acierto de una empresa se mide con sus tarifas de hoy, no con las que tenía
cuando se calculó: cada estimación guarda la mudanza (`inputs`) y acá se vuelve
a pasar por la fórmula. Así sirve todo su historial (el API principal lo deja
comparable con `flask auto-quote-backfill`), cambiar una tarifa se ve al
instante, y a una empresa sin tarifas se le pueden sugerir (`rates_fit.py`).
"""
from statistics import median

from flask import g, jsonify

from . import api
from .decorators import login_required
from .. import db
from ..carrier_rates import company_rates
from ..models import AutoQuoteEstimate, CarrierCompany, Order, Quotation, ROLE_ADMIN, ROLE_SUPERADMIN, _iso
from ..rates_fit import FIELDS as SUGGESTED_FIELDS, suggest
from ..rates_formula import estimate as formula_estimate, rates_complete

# Lo que importa no es acertar parejo sino no quedar muy por debajo: una
# cotización automática ata a la empresa a ese precio, y una muy alta solo
# pierde la orden. "Cerca" es entre LOW abajo y HIGH arriba de lo que cotizó.
# Una empresa está lista con tantas comparaciones, casi ninguna muy por debajo
# y la mayoría cerca.
#
# Con 232 cotizaciones de producción (noviembre de 2026) y las mejores tarifas
# posibles para cada empresa, la regla de antes (75% a ±25%) solo la pasaba una:
# los transportistas varían más que eso entre ellos mismos (prediciendo a cada
# uno con lo que cotizaron los demás en la misma orden se acierta 64%).
LOW = 0.25
HIGH = 0.40
READY_MIN_COMPARED = 10
READY_MAX_LOW_SHARE = 0.10
READY_MIN_NEAR_SHARE = 0.60
RULE = {'low': LOW, 'high': HIGH, 'min_compared': READY_MIN_COMPARED, 'max_low_share': READY_MAX_LOW_SHARE,
        'min_near_share': READY_MIN_NEAR_SHARE}

FORMULA_FIELDS = ('base_fee', 'per_m3', 'per_loader', 'per_floor', 'minimum_fare', 'per_km_outside_lima',
                  'weekend_surcharge_percent')
MOVE_FIELDS = ('m3', 'km', 'floors', 'loaders', 'weekend', 'outside_lima')
# Las filas que guardan una mudanza comparable: se calculó, o la empresa no
# tenía tarifas ese día. Las demás (rechazó, no podía) no se comparan.
COMPARABLE = (None, 'no_rates')

SKIP_LABELS = {
    'load_type': 'No es mudanza ni cosas (carga o vehículo)',
    'no_date': 'Sin fecha',
    'outside_lima': 'Origen o destino fuera de Lima',
    'no_items': 'Sin lista de cosas',
    'no_rates': 'Ninguna empresa tiene tarifas',
    'error': 'No se pudo calcular (error del sistema)',
}
REASON_LABELS = {
    'no_rates': 'Sin tarifas',
    'declined': 'Rechazó la orden',
    'unavailable': 'No puede ese día',
    'too_big': 'Lleva menos m³',
    'too_far': 'No va tan lejos',
}


def _is_admin():
    return g.current_user.role in (ROLE_SUPERADMIN, ROLE_ADMIN)


def _real_quotations(estimates):
    """La cotización real de cada estimación: la de esa empresa en esa orden,
    hecha o cambiada después de ese aviso y antes del siguiente (después del
    siguiente, la orden ya era otra)."""
    if not estimates:
        return {}
    order_ids = {e.order_id for e in estimates}
    notices = {}
    for e in estimates:
        notices.setdefault(e.order_id, set()).add(e.notified_at)
    quotations = Quotation.query.filter(Quotation.order_id.in_(order_ids)).order_by(Quotation.id).all()
    result = {}
    for e in estimates:
        later = sorted(n for n in notices[e.order_id] if n > e.notified_at)
        until = later[0] if later else None
        for q in quotations:
            when = q.updated_date or q.created_date
            if (q.order_id == e.order_id and q.carrier_company_id == e.carrier_company_id and when
                    and when >= e.notified_at and (until is None or when < until)):
                result[e.id] = q
    return result


def _error(estimate, quotation):
    if estimate.amount is None or quotation is None or not quotation.amount:
        return None
    return (estimate.amount - quotation.amount) / quotation.amount


@api.route('/orders/<int:order_id>/auto-quote', methods=['GET'])
@login_required
def order_auto_quote(order_id):
    """Lo que se calculó para la orden en su último aviso, empresa por empresa,
    con su cotización real si la hay, y los m³ con el desglose de la lista."""
    if not _is_admin():
        return jsonify({'message': 'forbidden'}), 403
    order = db.session.get(Order, order_id)
    if order is None:
        return jsonify({'message': 'order not found'}), 404

    all_estimates = AutoQuoteEstimate.query.filter_by(order_id=order_id).all()
    latest = max((e.notified_at for e in all_estimates), default=None)
    estimates = [e for e in all_estimates if e.notified_at == latest]
    real = _real_quotations(all_estimates)
    names = dict(db.session.query(CarrierCompany.id, CarrierCompany.name)
                 .filter(CarrierCompany.id.in_({e.carrier_company_id for e in estimates})).all()) if estimates else {}

    rows = []
    for e in sorted(estimates, key=lambda e: (e.amount is None, e.amount or 0)):
        quotation = real.get(e.id)
        if e.skip_reason == 'no_rates' and quotation is None:
            continue
        error = _error(e, quotation)
        rows.append({
            'carrier_company_id': e.carrier_company_id,
            'name': names.get(e.carrier_company_id),
            'amount': e.amount,
            'skip_reason': e.skip_reason,
            'skip_label': REASON_LABELS.get(e.skip_reason),
            'lines': e.lines,
            'inputs': e.inputs,
            'quoted': quotation.amount if quotation else None,
            'error': round(error, 3) if error is not None else None,
        })
    return jsonify({
        'checked_at': _iso(order.auto_quote_checked_at),
        'notified_at': _iso(latest),
        'skip': order.auto_quote_skip,
        'skip_label': SKIP_LABELS.get(order.auto_quote_skip),
        'volume': order.volume_breakdown,
        'estimated_volume_m3': float(order.estimated_volume_m3) if order.estimated_volume_m3 is not None else None,
        'estimates': rows,
    }), 200


def _move(estimate):
    return {field: estimate.inputs[field] for field in MOVE_FIELDS if field in (estimate.inputs or {})}


def _measure(moves, rates):
    """Cómo quedan las tarifas contra lo que la empresa cotizó: `moves` es
    [(estimación, cotización)]. Vacío si faltan la base o el precio por m³."""
    rows = []
    if rates_complete(rates):
        for e, quotation in moves:
            amount = formula_estimate(rates, **_move(e))['total']
            rows.append({'order_id': e.order_id, 'amount': amount, 'quoted': quotation.amount,
                         'error': round((amount - quotation.amount) / quotation.amount, 3),
                         'notified_at': _iso(e.notified_at)})
    rows.sort(key=lambda r: r['notified_at'], reverse=True)
    compared = len(rows)
    low = sum(1 for r in rows if r['error'] < -LOW)
    high = sum(1 for r in rows if r['error'] > HIGH)
    near = compared - low - high
    return {
        'compared': compared, 'near': near, 'low': low, 'high': high,
        'near_share': round(near / compared, 3) if compared else None,
        'low_share': round(low / compared, 3) if compared else None,
        'median_error': round(median(r['error'] for r in rows), 3) if rows else None,
        'ready': (compared >= READY_MIN_COMPARED and low <= READY_MAX_LOW_SHARE * compared
                  and near >= READY_MIN_NEAR_SHARE * compared),
        'recent': rows[:20],
    }


@api.route('/carrier-companies/<int:company_id>/auto-quote-accuracy', methods=['GET'])
@login_required
def company_auto_quote_accuracy(company_id):
    """Cuánto acierta la empresa con sus tarifas de hoy contra todo lo que
    cotizó, y las tarifas que saldrían de esas cotizaciones. Solo admins: es
    para decidir a quién encender."""
    if not _is_admin():
        return jsonify({'message': 'forbidden'}), 403
    if db.session.get(CarrierCompany, company_id) is None:
        return jsonify({'message': 'carrier company not found'}), 404

    estimates = AutoQuoteEstimate.query.filter(AutoQuoteEstimate.carrier_company_id == company_id).all()
    order_ids = {e.order_id for e in estimates}
    # Las otras empresas también cuentan para saber dónde termina cada aviso.
    every = AutoQuoteEstimate.query.filter(AutoQuoteEstimate.order_id.in_(order_ids)).all() if order_ids else []
    real = _real_quotations(every)
    moves = [(e, real[e.id]) for e in estimates
             if e.skip_reason in COMPARABLE and (e.inputs or {}).get('m3') and e.id in real and real[e.id].amount]

    saved = company_rates(company_id)
    rates = {field: getattr(saved, field) for field in FORMULA_FIELDS} if saved else {}
    suggested = suggest([(_move(e), q.amount) for e, q in moves], LOW, HIGH, READY_MAX_LOW_SHARE,
                        weekend_percent=rates.get('weekend_surcharge_percent'))
    if suggested is not None:
        with_them = _measure(moves, {**rates, **suggested})
        suggested = {'rates': suggested, **{k: with_them[k] for k in ('near_share', 'low_share', 'ready')}}
    return jsonify({
        'has_rates': rates_complete(rates),
        'quotations': len(moves),
        **_measure(moves, rates),
        'rule': RULE,
        'suggested': suggested,
        'suggested_fields': SUGGESTED_FIELDS,
    }), 200
