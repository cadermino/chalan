"""Lo que cada empresa habría cotizado con sus tarifas, al lado de lo que cotizó.

El API principal lo calcula en silencio a los 20 minutos de avisada una orden
(api/auto_quote.py allá) y lo guarda en `auto_quote_estimates`. Esto lo muestra a
los admins: por orden, y por empresa cuánto acierta, que es lo que decide a
quién se puede encender la cotización automática.
"""
from statistics import median

from flask import g, jsonify

from . import api
from .decorators import login_required
from .. import db
from ..models import AutoQuoteEstimate, CarrierCompany, Order, Quotation, ROLE_ADMIN, ROLE_SUPERADMIN, _iso

# Una estimación acierta si queda a menos de esto del precio real, y una empresa
# está lista para encenderse con tantas comparaciones y esa parte de aciertos.
TOLERANCE = 0.25
READY_MIN_COMPARED = 10
READY_SHARE = 0.75

SKIP_LABELS = {
    'load_type': 'No es mudanza ni cosas (carga o vehículo)',
    'no_date': 'Sin fecha',
    'outside_lima': 'Origen o destino fuera de Lima',
    'no_items': 'Sin lista de cosas',
    'no_rates': 'Ninguna empresa tiene tarifas',
}
REASON_LABELS = {
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


@api.route('/carrier-companies/<int:company_id>/auto-quote-accuracy', methods=['GET'])
@login_required
def company_auto_quote_accuracy(company_id):
    """Cuánto acierta la empresa con sus tarifas: sus estimaciones con precio que
    tienen cotización real. Solo admins: es para decidir a quién encender."""
    if not _is_admin():
        return jsonify({'message': 'forbidden'}), 403
    if db.session.get(CarrierCompany, company_id) is None:
        return jsonify({'message': 'carrier company not found'}), 404

    estimates = AutoQuoteEstimate.query.filter(AutoQuoteEstimate.carrier_company_id == company_id).all()
    order_ids = {e.order_id for e in estimates}
    # Las otras empresas también cuentan para saber dónde termina cada aviso.
    every = AutoQuoteEstimate.query.filter(AutoQuoteEstimate.order_id.in_(order_ids)).all() if order_ids else []
    real = _real_quotations(every)

    compared = []
    for e in estimates:
        error = _error(e, real.get(e.id))
        if error is not None:
            compared.append({'order_id': e.order_id, 'amount': e.amount, 'quoted': real[e.id].amount,
                             'error': round(error, 3), 'notified_at': _iso(e.notified_at)})
    compared.sort(key=lambda c: c['notified_at'], reverse=True)
    hits = sum(1 for c in compared if abs(c['error']) <= TOLERANCE)
    share = hits / len(compared) if compared else None
    return jsonify({
        'estimated': sum(1 for e in estimates if e.amount is not None),
        'compared': len(compared),
        'hits': hits,
        'share': round(share, 3) if share is not None else None,
        'median_error': round(median(c['error'] for c in compared), 3) if compared else None,
        'ready': len(compared) >= READY_MIN_COMPARED and share >= READY_SHARE,
        'tolerance': TOLERANCE,
        'ready_min_compared': READY_MIN_COMPARED,
        'ready_share': READY_SHARE,
        'recent': compared[:20],
    }), 200
