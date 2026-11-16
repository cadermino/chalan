"""Versiones de una orden desde que salió a transportistas (migración 051).

El cliente cambiaba el día, las cosas o las direcciones después de mandar la
orden, y el PUT pisaba lo que había: el transportista recibía "La orden cambió,
vuelve a cotizar" y tenía que adivinar qué. Ahora cada cambio deja una foto
entera de lo que lee un transportista, y el diff entre dos fotos cualesquiera se
arma al leer, como entre dos commits.

- Antes del primer aviso no se guarda nada: es un borrador que nadie vio.
- Una foto igual a la anterior (lo que se ve, `diff_snapshots`) no es versión.
- Los textos del diff salen de aquí ya escritos. El backoffice, el link del
  transportista (y más adelante el correo) solo los pintan: no hay otra copia
  de las etiquetas que mantener.
- Un transportista ve lo mismo que en la orden (`for_carrier`): el presupuesto
  sin la comisión, y en el backoffice solo el distrito hasta que la mudanza es
  suya.
"""
import difflib
from datetime import datetime

from flask import current_app

from ... import db
from ..address import district_of
from ..quotation.quotation_status import QuotationStatus
from ...models import (CarrierCompany, LuServices, Order, OrderImage, OrderVersion,
                       OrderVideo, Quotations)
from .load import CARGO_WEIGHT_LABELS, LOAD_TYPE_LABELS
from .order import customer_markup
from .order_status import OrderStatus

ADDRESS_FIELDS = ('street', 'interior_number', 'floor_number', 'has_elevator',
                  'approximate_distance_from_parking', 'map_url', 'neighborhood', 'city',
                  'state', 'zip_code', 'country', 'latitude', 'longitude')

EMPTY = 'Sin dato'

_DAYS = ('lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom')
_MONTHS = ('ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic')

# Los tramos de frontend/src/utils/parking.js, con su mismo texto.
_PARKING = {0: 'En la puerta', 20: 'A menos de 20 m', 50: 'Entre 20 y 50 m', 100: 'A más de 50 m'}

_DATE_FORMATS = ('%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M:%S.%f',
                 '%Y-%m-%d %H:%M:%S.%f')


# --- La foto -----------------------------------------------------------------

def _appointment(value):
    if isinstance(value, str):
        for fmt in _DATE_FORMATS:
            try:
                value = datetime.strptime(value, fmt)
                break
            except ValueError:
                continue
        else:
            return None
    return value.strftime('%Y-%m-%d %H:%M:%S') if isinstance(value, datetime) else None


def _int(value):
    try:
        return int(value) if value not in (None, '') else None
    except (TypeError, ValueError):
        return None


def _float(value, digits=None):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return round(number, digits) if digits is not None else number


def _text(value):
    return value.strip() if isinstance(value, str) and value.strip() else None


def _comments(value):
    """Una cosa por línea, sin espacios ni líneas vacías: así un espacio de más
    no es un cambio."""
    lines = (value or '').replace('\r\n', '\n').replace('\r', '\n').split('\n')
    return '\n'.join(line.strip() for line in lines if line.strip())


def _address(detail):
    if detail is None:
        return None
    return {
        'street': _text(detail.street),
        'interior_number': _text(detail.interior_number),
        'floor_number': _int(detail.floor_number),
        'has_elevator': bool(detail.has_elevator),
        'approximate_distance_from_parking': _int(detail.approximate_distance_from_parking),
        'map_url': _text(detail.map_url),
        'neighborhood': _text(detail.neighborhood),
        'city': _text(detail.city),
        'state': _text(detail.state),
        'zip_code': _text(detail.zip_code),
        'country': _text(detail.country),
        'latitude': _float(detail.latitude, 6),
        'longitude': _float(detail.longitude, 6),
    }


def build_snapshot(order):
    """Lo que lee un transportista de la orden, solo con tipos de JSON y siempre
    las mismas claves: dos fotos del mismo estado son iguales con `==` después
    de pasar por la base."""
    return {
        'appointment_date': _appointment(order.appointment_date),
        'load_type': order.load_type,
        'cargo_weight_kg': _int(order.cargo_weight_kg),
        'comments': _comments(order.comments),
        'loaders_quantity': _int(order.loaders_quantity),
        'approximate_budget': _float(order.approximate_budget),
        'services': sorted(s.service.service for s in order.services if s.service),
        'origin': _address(order.order_details.filter_by(type='carry_from').first()),
        'destination': _address(order.order_details.filter_by(type='deliver_to').first()),
        'images': [i.id for i in order.images.order_by(OrderImage.id)],
        'videos': [v.id for v in OrderVideo.query.filter_by(order_id=order.id).order_by(OrderVideo.id)],
    }


# --- Guardar -----------------------------------------------------------------

def current_version(order_id):
    return (OrderVersion.query.filter_by(order_id=order_id)
            .order_by(OrderVersion.number.desc()).first())


def record_version(order_id, author, admin_user_id=None, notified=False):
    """Guarda la orden como versión nueva si cambió lo que se ve. `notified`:
    se acaba de mandar a transportistas (crea la versión 1 la primera vez, y
    marca la vigente las siguientes).

    Nunca rompe a quien la llama: perder una versión es mejor que un 500 al
    guardar una mudanza. Quien llama ya hizo su commit, así que el rollback no
    se lleva nada suyo.
    """
    try:
        return _record(order_id, author, admin_user_id, notified)
    except Exception:
        current_app.logger.exception('No se pudo guardar la versión de la orden %s', order_id)
        db.session.rollback()
        return None


def _record(order_id, author, admin_user_id, notified):
    order = db.session.get(Order, order_id)
    if order is None or (order.carrier_notified_at is None and not notified):
        return None
    snapshot = build_snapshot(order)
    last = current_version(order_id)
    now = datetime.utcnow()
    if last is not None and not diff_snapshots(last.snapshot, snapshot):
        if notified:
            last.notified_at = now
            db.session.commit()
        return last
    version = OrderVersion(
        order_id=order_id,
        number=last.number + 1 if last else 1,
        author=author,
        admin_user_id=admin_user_id if author == 'admin' else None,
        snapshot=snapshot,
        notified_at=now if notified else None,
        created_date=now,
    )
    db.session.add(version)
    db.session.commit()
    return version


def backfill(apply=False):
    """La versión 1 de las órdenes pendientes que ya habían salido a
    transportistas antes del historial: lo que tienen hoy, avisado cuando se
    avisó. Se puede repetir: la que ya tiene versiones no se toca."""
    with_versions = db.session.query(OrderVersion.order_id).distinct()
    orders = Order.query.filter(
        Order.order_status_id == OrderStatus.pending(),
        Order.carrier_notified_at.isnot(None),
        Order.id.notin_(with_versions),
    ).order_by(Order.id).all()
    if apply:
        for order in orders:
            db.session.add(OrderVersion(
                order_id=order.id, number=1, author='customer',
                snapshot=build_snapshot(order), notified_at=order.carrier_notified_at,
            ))
        db.session.commit()
    return len(orders)


# --- El diff -----------------------------------------------------------------

def services_catalog():
    return {s.service: s.description or s.service for s in LuServices.query.all()}


def format_date(value):
    moment = _appointment(value)
    if moment is None:
        return EMPTY
    moment = datetime.strptime(moment, '%Y-%m-%d %H:%M:%S')
    hour = moment.hour % 12 or 12
    suffix = 'am' if moment.hour < 12 else 'pm'
    return (f'{_DAYS[moment.weekday()]} {moment.day} {_MONTHS[moment.month - 1]}, '
            f'{hour}:{moment.minute:02d} {suffix}')


def format_soles(value):
    if not value:
        return EMPTY
    return f'S/ {value:,.0f}' if float(value).is_integer() else f'S/ {value:,.2f}'


def _plural(n, one, many, none):
    return none if not n else f'{n} {one if n == 1 else many}'


def _shown(value):
    return EMPTY if value in (None, '') else str(value)


def _value(field, label, before, after):
    return {'field': field, 'label': label, 'kind': 'value', 'before': before, 'after': after}


def _lines(before, after):
    a = [line for line in (before or '').split('\n') if line]
    b = [line for line in (after or '').split('\n') if line]
    lines = []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if tag == 'equal':
            lines.extend({'op': '=', 'text': t} for t in a[i1:i2])
            continue
        lines.extend({'op': '-', 'text': t} for t in a[i1:i2])
        lines.extend({'op': '+', 'text': t} for t in b[j1:j2])
    return lines


def _address_entries(side, label, before, after):
    before, after = before or {}, after or {}
    entries = []
    if before.get('street') != after.get('street'):
        entries.append(_value(f'{side}.street', label,
                              _shown(before.get('street')), _shown(after.get('street'))))
    elif any(before.get(k) != after.get(k) for k in ('map_url', 'latitude', 'longitude')):
        entries.append(_value(f'{side}.location', f'{label}: punto en el mapa',
                              None, 'Se movió el punto en el mapa'))
    which = label.lower()
    for field, name, shown in (
        ('interior_number', 'Interior', _shown),
        ('floor_number', 'Piso', _shown),
        ('has_elevator', 'Ascensor', lambda v: 'Sí' if v else 'No'),
        ('approximate_distance_from_parking', 'Distancia al estacionamiento',
         lambda v: EMPTY if v is None else _PARKING.get(v, f'{v} m')),
    ):
        if before.get(field) != after.get(field):
            entries.append(_value(f'{side}.{field}', f'{name} ({which})',
                                  shown(before.get(field)), shown(after.get(field))))
    return entries


def _media_entry(field, label, before, after, one, many, none, changed):
    before, after = before or [], after or []
    if before == after:
        return None
    if len(before) == len(after):
        return _value(field, label, None, changed)
    return _value(field, label, _plural(len(before), one, many, none),
                  _plural(len(after), one, many, none))


def diff_snapshots(before, after, catalog=None):
    """Lo que cambió de `before` a `after`, en el orden en que lo lee el
    transportista. Cada entrada trae su etiqueta y sus valores ya escritos:
    `value` (antes → después; sin `before` cuando solo se dice qué pasó),
    `lines` (la lista de cosas, línea por línea) o `list` (servicios)."""
    entries = []
    if before.get('appointment_date') != after.get('appointment_date'):
        entries.append(_value('appointment_date', 'Fecha', format_date(before.get('appointment_date')),
                              format_date(after.get('appointment_date'))))
    if (before.get('load_type') or 'moving') != (after.get('load_type') or 'moving'):
        entries.append(_value('load_type', 'Qué lleva',
                              LOAD_TYPE_LABELS.get(before.get('load_type') or 'moving', EMPTY),
                              LOAD_TYPE_LABELS.get(after.get('load_type') or 'moving', EMPTY)))
    if before.get('cargo_weight_kg') != after.get('cargo_weight_kg'):
        weight = lambda v: EMPTY if v is None else CARGO_WEIGHT_LABELS.get(v, f'{v} kg')
        entries.append(_value('cargo_weight_kg', 'Peso', weight(before.get('cargo_weight_kg')),
                              weight(after.get('cargo_weight_kg'))))
    if (before.get('comments') or '') != (after.get('comments') or ''):
        entries.append({'field': 'comments', 'label': 'Cosas', 'kind': 'lines',
                        'lines': _lines(before.get('comments'), after.get('comments'))})
    if (before.get('loaders_quantity') or 0) != (after.get('loaders_quantity') or 0):
        loaders = lambda v: str(v) if v else 'Sin cargadores'
        entries.append(_value('loaders_quantity', 'Cargadores', loaders(before.get('loaders_quantity')),
                              loaders(after.get('loaders_quantity'))))
    if (before.get('approximate_budget') or 0) != (after.get('approximate_budget') or 0):
        entries.append(_value('approximate_budget', 'Presupuesto',
                              format_soles(before.get('approximate_budget')),
                              format_soles(after.get('approximate_budget'))))
    old_services, new_services = set(before.get('services') or []), set(after.get('services') or [])
    if old_services != new_services:
        catalog = services_catalog() if catalog is None else catalog
        entries.append({'field': 'services', 'label': 'Servicios', 'kind': 'list',
                        'added': [catalog.get(s, s) for s in sorted(new_services - old_services)],
                        'removed': [catalog.get(s, s) for s in sorted(old_services - new_services)]})
    entries.extend(_address_entries('origin', 'Origen', before.get('origin'), after.get('origin')))
    entries.extend(_address_entries('destination', 'Destino', before.get('destination'),
                                    after.get('destination')))
    for entry in (
        _media_entry('images', 'Fotos', before.get('images'), after.get('images'),
                     'foto', 'fotos', 'Sin fotos', 'Cambiaron las fotos'),
        _media_entry('videos', 'Videos', before.get('videos'), after.get('videos'),
                     'video', 'videos', 'Sin videos', 'Cambiaron los videos'),
    ):
        if entry:
            entries.append(entry)
    return entries


# --- Lo que lee el backoffice ------------------------------------------------

def _iso(moment):
    return moment.isoformat() + '+00:00' if moment else None


def history_for_admin(order_id):
    """Todas las versiones de la orden, cada una con lo que cambió respecto de
    la anterior (la 1 es lo que se mandó), y las cotizaciones con la versión
    sobre la que se hicieron. Sin filtrar: es para los admins."""
    versions = OrderVersion.query.filter_by(order_id=order_id).order_by(OrderVersion.number).all()
    catalog = services_catalog()
    history = []
    previous = None
    for version in versions:
        history.append({
            'number': version.number,
            'created_date': _iso(version.created_date),
            'author': version.author,
            'admin_user_id': version.admin_user_id,
            'notified_at': _iso(version.notified_at),
            'entries': diff_snapshots(previous.snapshot, version.snapshot, catalog) if previous else [],
        })
        previous = version
    numbers = {v.id: v.number for v in versions}
    quotations = (Quotations.query.filter_by(order_id=order_id)
                  .order_by(Quotations.id).all())
    company_ids = {q.carrier_company_id for q in quotations if q.carrier_company_id}
    companies = {c.id: c.name for c in CarrierCompany.query.filter(
        CarrierCompany.id.in_(company_ids))} if company_ids else {}
    return {
        'current_number': versions[-1].number if versions else None,
        'versions': history,
        'quotations': [{
            'id': q.id,
            'carrier_company_id': q.carrier_company_id,
            'carrier_company_name': companies.get(q.carrier_company_id),
            'quotation_status_id': q.quotation_status_id,
            'amount': q.amount,
            'version_number': numbers.get(q.order_version_id),
        } for q in quotations],
    }


# --- Lo que lee un transportista ---------------------------------------------

_HIDDEN_BY_DISTRICT = ('interior_number', 'location')


def _budget_entry(before, after, markup):
    """El presupuesto como lo ve el transportista: sin la comisión, como en su
    link. Dos montos que sin ella dan lo mismo no son un cambio."""
    shown = lambda v: format_soles(round(v / markup)) if v else EMPTY
    old, new = shown(before.get('approximate_budget')), shown(after.get('approximate_budget'))
    return None if old == new else _value('approximate_budget', 'Presupuesto', old, new)


def _district_entry(entry, side, before, after):
    """La calle, pero solo el distrito: es lo que el backoffice le muestra a una
    empresa antes de que la mudanza sea suya (`_address_payload`)."""
    old = district_of(before.get(side) or {}) or EMPTY
    new = district_of(after.get(side) or {}) or EMPTY
    if old == new:
        return _value(entry['field'], entry['label'], None, f'Cambió la dirección (sigue en {new})')
    return _value(entry['field'], entry['label'], old, new)


def for_carrier(entries, order_id, before, after, address):
    """Las entradas que puede leer una empresa. `address`: `full` (su link de
    cotización, o la mudanza ya es suya) o `district` (el backoffice antes de
    que sea suya)."""
    markup = customer_markup(order_id)
    out = []
    for entry in entries:
        field = entry['field']
        side, _, part = field.partition('.')
        if field == 'approximate_budget':
            entry = _budget_entry(before, after, markup)
        elif address == 'district' and part in _HIDDEN_BY_DISTRICT:
            entry = None
        elif address == 'district' and part == 'street':
            entry = _district_entry(entry, side, before, after)
        if entry:
            out.append(entry)
    return out


def changes_for_carrier(order_id, carrier_company_id, address):
    """Lo que cambió la orden desde que esta empresa cotizó (o desde que se le
    mandó, si no cotizó), o None si no hay nada que mostrarle.

    La base es la versión de su última cotización, también si se canceló al
    cambiar la orden: es lo último que leyó. Una cotización de antes del
    historial, o ninguna, se compara con la versión 1. A una empresa que no
    eligieron no se le muestra nada: ya no tiene qué cotizar.
    """
    order = db.session.get(Order, order_id)
    versions = OrderVersion.query.filter_by(order_id=order_id).order_by(OrderVersion.number).all()
    if order is None or not versions:
        return None
    quotations = Quotations.query.filter_by(order_id=order_id)
    selected = quotations.filter_by(quotation_status_id=QuotationStatus.Selected()).first()
    if selected is not None and selected.carrier_company_id != carrier_company_id:
        return None
    if selected is None and order.order_status_id != OrderStatus.pending():
        return None

    own = (quotations.filter_by(carrier_company_id=carrier_company_id)
           .order_by(Quotations.updated_date.desc(), Quotations.id.desc()).first())
    by_id = {v.id: v for v in versions}
    base = by_id.get(own.order_version_id) if own else None
    base = base or versions[0]
    current = versions[-1]
    if base is current:
        return None

    catalog = services_catalog()

    def visible(older, newer):
        entries = diff_snapshots(older.snapshot, newer.snapshot, catalog)
        return for_carrier(entries, order_id, older.snapshot, newer.snapshot, address)

    entries = visible(base, current)
    if not entries:
        return None
    later = [v for v in versions if v.number > base.number]
    history = []
    previous = base
    for version in later:
        step = visible(previous, version)
        if step:
            history.append({
                'number': version.number,
                'created_date': _iso(version.created_date),
                'author': 'chalan' if version.author == 'admin' else 'customer',
                'entries': step,
            })
        previous = version
    return {
        'since': 'quotation' if own else 'sent',
        'since_date': _iso(own.updated_date if own else (base.notified_at or base.created_date)),
        'changed_at': _iso(current.created_date),
        'entries': entries,
        'history': history,
    }
