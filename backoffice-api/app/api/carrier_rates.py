"""Tarifas y disponibilidad de una empresa, desde el backoffice (migración 047).

La empresa edita las suyas y un admin las de cualquiera, por ejemplo con lo que
el transportista le dicta por WhatsApp. El cálculo y las reglas del calendario
viven en `app/carrier_rates.py`.
"""
from datetime import date, datetime, timedelta

from flask import g, jsonify, request

from . import api
from .carrier_companies import _can_access_company
from .decorators import login_required
from .. import db
from ..carrier_rates import (BLOCKED_PARTS, RATE_FIELDS, availability_rules, blocked_on, booked_moves,
                             company_rates, estimate, lima_today, parse_rate, rates_complete)
from ..models import AdminUser, CarrierAvailability, CarrierCompany, CarrierRates, ROLE_CARRIER, _iso, _money

MAX_CALENDAR_DAYS = 62
# Hasta cuándo se puede marcar un día: más allá nadie sabe si podrá.
BOOKABLE_DAYS_AHEAD = 400


def _company_or_error(company_id):
    if not _can_access_company(company_id):
        return None, (jsonify({'message': 'forbidden'}), 403)
    company = db.session.get(CarrierCompany, company_id)
    if company is None:
        return None, (jsonify({'message': 'carrier company not found'}), 404)
    return company, None


def _rates_dict(rates):
    if rates is None:
        return {**{field: None for field in RATE_FIELDS}, 'moves_per_day': 1, 'auto_quote': False,
                'auto_quote_authorized_at': None, 'auto_quote_authorized_by': None}
    result = {}
    for field, (_, _, integer) in RATE_FIELDS.items():
        value = getattr(rates, field)
        result[field] = value if integer or value is None else _money(value)
    authorized_by = db.session.get(AdminUser, rates.auto_quote_authorized_by) if rates.auto_quote_authorized_by else None
    result.update({
        'auto_quote': bool(rates.auto_quote),
        'auto_quote_authorized_at': _iso(rates.auto_quote_authorized_at),
        'auto_quote_authorized_by': {
            'name': ' '.join(filter(None, [authorized_by.first_name, authorized_by.last_name])) or authorized_by.email,
            'is_company': authorized_by.role == ROLE_CARRIER,
        } if authorized_by else None,
    })
    return result


@api.route('/carrier-companies/<int:company_id>/rates', methods=['GET'])
@login_required
def get_carrier_rates(company_id):
    _, error = _company_or_error(company_id)
    if error:
        return error
    rates = company_rates(company_id)
    return jsonify({'rates': _rates_dict(rates), 'complete': rates_complete(_rates_dict(rates))}), 200


@api.route('/carrier-companies/<int:company_id>/rates', methods=['PUT'])
@login_required
def update_carrier_rates(company_id):
    """Cambia los campos que llegan; los que no vienen quedan como estaban."""
    _, error = _company_or_error(company_id)
    if error:
        return error
    data = request.get_json(silent=True) or {}

    changes = {}
    for field in RATE_FIELDS:
        if field in data:
            try:
                changes[field] = parse_rate(field, data[field])
            except ValueError as exc:
                return jsonify({'message': str(exc), 'field': field}), 400
    if 'auto_quote' in data and not isinstance(data['auto_quote'], bool):
        return jsonify({'message': 'auto_quote must be true or false', 'field': 'auto_quote'}), 400

    rates = company_rates(company_id)
    if rates is None:
        rates = CarrierRates(carrier_company_id=company_id, moves_per_day=1, auto_quote=False)
        db.session.add(rates)
    for field, value in changes.items():
        setattr(rates, field, value)

    wants_auto_quote = data.get('auto_quote', bool(rates.auto_quote))
    if wants_auto_quote and not rates_complete({f: getattr(rates, f) for f in RATE_FIELDS}):
        db.session.rollback()
        return jsonify({'message': 'auto_quote needs base_fee and per_m3', 'field': 'auto_quote'}), 400
    if wants_auto_quote and not rates.auto_quote:
        # Quién autorizó y cuándo: compromete el precio de la empresa.
        rates.auto_quote_authorized_at = datetime.utcnow()
        rates.auto_quote_authorized_by = g.current_user.id
    elif not wants_auto_quote:
        rates.auto_quote_authorized_at = None
        rates.auto_quote_authorized_by = None
    rates.auto_quote = wants_auto_quote
    rates.updated_date = datetime.utcnow()
    db.session.commit()
    result = _rates_dict(rates)
    return jsonify({'rates': result, 'complete': rates_complete(result)}), 200


@api.route('/carrier-companies/<int:company_id>/rates/simulate', methods=['POST'])
@login_required
def simulate_carrier_rates(company_id):
    """Lo que saldría cada mudanza de ejemplo con las tarifas que llegan, sin
    guardarlas: el transportista ve el total mientras escribe. Un campo mal
    escrito se ignora y se devuelve en `errors`."""
    _, error = _company_or_error(company_id)
    if error:
        return error
    data = request.get_json(silent=True) or {}
    rates, errors = {}, {}
    for field in RATE_FIELDS:
        try:
            rates[field] = parse_rate(field, (data.get('rates') or {}).get(field, 1 if field == 'moves_per_day' else None))
        except ValueError as exc:
            rates[field] = None
            errors[field] = str(exc)

    scenarios = data.get('scenarios')
    if not isinstance(scenarios, list) or not 1 <= len(scenarios) <= 10:
        return jsonify({'message': 'scenarios must be a list of 1 to 10 moves'}), 400
    results = []
    for scenario in scenarios:
        if not isinstance(scenario, dict):
            return jsonify({'message': 'each scenario must be an object'}), 400
        try:
            move = {
                'm3': _number(scenario.get('m3'), 0, 200),
                'km': _number(scenario.get('km', 0), 0, 5000),
                'floors': int(_number(scenario.get('floors', 0), 0, 60)),
                'loaders': int(_number(scenario.get('loaders', 0), 0, 20)),
                'weekend': bool(scenario.get('weekend')),
                'outside_lima': bool(scenario.get('outside_lima')),
            }
        except ValueError as exc:
            return jsonify({'message': str(exc)}), 400
        results.append(estimate(rates, **move))
    return jsonify({'results': results, 'errors': errors, 'complete': rates_complete(rates)}), 200


def _number(value, low, high):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not low <= value <= high:
        raise ValueError(f'scenario values must be numbers between {low} and {high}')
    return value


def _parse_date(value, name):
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValueError(f'{name} must be a date (YYYY-MM-DD)')


@api.route('/carrier-companies/<int:company_id>/availability', methods=['GET'])
@login_required
def get_carrier_availability(company_id):
    """Cada día entre `from` y `to` (por defecto, el mes en curso): qué parte no
    puede la empresa, de dónde sale, y las mudanzas que ya tiene."""
    _, error = _company_or_error(company_id)
    if error:
        return error
    today = lima_today()
    try:
        start = _parse_date(request.args['from'], 'from') if request.args.get('from') else today.replace(day=1)
        end = (_parse_date(request.args['to'], 'to') if request.args.get('to')
               else (start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1))
    except ValueError as exc:
        return jsonify({'message': str(exc)}), 400
    if end < start or (end - start).days >= MAX_CALENDAR_DAYS:
        return jsonify({'message': f'the range must be 1 to {MAX_CALENDAR_DAYS} days'}), 400

    weekly, days = availability_rules([company_id])
    weekly, days = weekly.get(company_id, {}), days.get(company_id, {})
    booked = booked_moves([company_id], start, end).get(company_id, [])
    rates = company_rates(company_id)

    result = []
    current = start
    while current <= end:
        blocked, source = blocked_on(weekly, days, current)
        result.append({
            'date': current.isoformat(),
            'blocked': blocked,
            'source': source,
            'booked': [{'order_id': b['order_id'], 'part': b['part']}
                       for b in booked if b['date'] == current.isoformat()],
            'editable': today <= current <= today + timedelta(days=BOOKABLE_DAYS_AHEAD),
        })
        current += timedelta(days=1)
    return jsonify({
        'today': today.isoformat(),
        'moves_per_day': rates.moves_per_day if rates else 1,
        'weekly': [weekly.get(weekday) for weekday in range(7)],
        'days': result,
    }), 200


def _source():
    return 'carrier' if g.current_user.role == ROLE_CARRIER else 'admin'


@api.route('/carrier-companies/<int:company_id>/availability/weekly', methods=['PUT'])
@login_required
def update_carrier_weekly_availability(company_id):
    """La semana entera: `weekly` son 7 valores, de lunes a domingo, cada uno
    `day`, `am`, `pm` (lo que no puede) o null (puede)."""
    _, error = _company_or_error(company_id)
    if error:
        return error
    weekly = (request.get_json(silent=True) or {}).get('weekly')
    if not isinstance(weekly, list) or len(weekly) != 7 or any(v not in BLOCKED_PARTS + (None,) for v in weekly):
        return jsonify({'message': 'weekly must be 7 values: day, am, pm or null'}), 400

    rows = {row.weekday: row for row in CarrierAvailability.query.filter(
        CarrierAvailability.carrier_company_id == company_id,
        CarrierAvailability.vehicle_id.is_(None),
        CarrierAvailability.weekday.isnot(None),
    )}
    for weekday, blocked in enumerate(weekly):
        row = rows.get(weekday)
        if blocked is None:
            if row:
                db.session.delete(row)
        elif row:
            row.blocked = blocked
        else:
            db.session.add(CarrierAvailability(carrier_company_id=company_id, weekday=weekday, blocked=blocked,
                                               source=_source(), created_by=g.current_user.id))
    db.session.commit()
    return jsonify({'weekly': weekly}), 200


@api.route('/carrier-companies/<int:company_id>/availability/days/<day>', methods=['PUT'])
@login_required
def update_carrier_day_availability(company_id, day):
    """Un día: `blocked` es `day`, `am`, `pm` o null (puede todo el día);
    `{"reset": true}` lo devuelve a lo que diga su semana. Lo que coincide con la
    semana no se guarda aparte, para que cambiar la semana después lo arrastre."""
    _, error = _company_or_error(company_id)
    if error:
        return error
    try:
        when = _parse_date(day, 'day')
    except ValueError as exc:
        return jsonify({'message': str(exc)}), 400
    today = lima_today()
    if not today <= when <= today + timedelta(days=BOOKABLE_DAYS_AHEAD):
        return jsonify({'message': 'only days from today on can be changed'}), 400
    data = request.get_json(silent=True) or {}
    if not data.get('reset') and ('blocked' not in data or data['blocked'] not in BLOCKED_PARTS + (None,)):
        return jsonify({'message': 'blocked must be day, am, pm or null'}), 400

    row = CarrierAvailability.query.filter_by(carrier_company_id=company_id, vehicle_id=None, day=when).first()
    weekly, _ = availability_rules([company_id])
    week_says = weekly.get(company_id, {}).get(when.weekday())
    if data.get('reset') or data['blocked'] == week_says:
        if row:
            db.session.delete(row)
    elif row:
        row.blocked = data['blocked']
        row.source = _source()
        row.created_by = g.current_user.id
    else:
        db.session.add(CarrierAvailability(carrier_company_id=company_id, day=when, blocked=data['blocked'],
                                           source=_source(), created_by=g.current_user.id))
    db.session.commit()
    _, days = availability_rules([company_id])
    blocked, source = blocked_on(weekly.get(company_id, {}), days.get(company_id, {}), when)
    return jsonify({'date': when.isoformat(), 'blocked': blocked, 'source': source}), 200
