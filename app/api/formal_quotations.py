"""Cotización formal en PDF (con RUC) de una cotización de mudanza.

La pide el cliente en el paso 3 (su sesión, dueño de la orden) o un admin desde
el backoffice (token interno, con dos opciones más: si el precio ya incluye IGV
y si se pide adelanto). El contenido lo arma `formal_quotation/build.py` y el
PDF `formal_quotation/render.py`; ver `formal_quotation/__init__.py`.

- `POST /order/<id>/formal-quotations` -> el PDF (y lo guarda).
- `GET /order/<id>/formal-quotations` -> las emitidas, los datos de la última
  que pidió el cliente (para precargar) y, para el backoffice, las cotizaciones.
- `GET /formal-quotations/<id>/pdf` -> la misma de nuevo, desde lo guardado.
"""
import os
import re
import unicodedata
from datetime import datetime
from zoneinfo import ZoneInfo

from flask import Response, jsonify, request

from . import api
from .decorators import authenticated_customer, is_internal_request
from .email import send_email
from .formal_quotation import issuer
from .formal_quotation.accounting import sync_accounting_note
from .formal_quotation.build import build_document, long_date, money_label
from .formal_quotation.render import render_pdf
from .formal_quotation.ruc import is_valid_ruc, normalize_ruc
from .order import Order as OrderEntity
from .order.load import CARGO_WEIGHT_LABELS
from .order.order import yape_reservation_required
from .order.order_status import OrderStatus
from .quotation.quotation_status import QuotationStatus
from .. import db
from ..models import FormalQuotation, Order, Payment, Quotations

EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
LIMA = ZoneInfo('America/Lima')


class InvalidClient(Exception):
    def __init__(self, field, message):
        super().__init__(message)
        self.field = field
        self.message = message


def _error(status, message, field=None):
    body = {'message': message}
    if field:
        body['field'] = field
    return jsonify(body), status


def _text(data, key, max_length):
    value = data.get(key)
    if value is None:
        return ''
    if not isinstance(value, str):
        raise InvalidClient(key, f'{key} must be text')
    value = ' '.join(value.split())
    if len(value) > max_length:
        raise InvalidClient(key, f'{key} is too long (max {max_length})')
    return value


def parse_client(data):
    ruc = normalize_ruc(data.get('ruc'))
    if not is_valid_ruc(ruc):
        raise InvalidClient('ruc', 'invalid RUC')
    business_name = _text(data, 'business_name', 200)
    if len(business_name) < 2:
        raise InvalidClient('business_name', 'business_name is required')
    contact_email = _text(data, 'contact_email', 255)
    if contact_email and not EMAIL_RE.match(contact_email):
        raise InvalidClient('contact_email', 'invalid email')
    return {
        'ruc': ruc,
        'business_name': business_name,
        'contact_name': _text(data, 'contact_name', 120),
        'contact_email': contact_email,
    }


def _caller(order):
    """('internal', None), ('customer', customer) o una respuesta de error."""
    if is_internal_request():
        return 'internal', None
    customer = authenticated_customer()
    if customer is None:
        return None, _error(401, 'unauthorized')
    if order is None or order.customer_id != customer.id:
        return None, _error(403, 'forbidden')
    return 'customer', customer


def _visible_quotation(order, quotation_id, internal):
    """La cotización de la orden que el que llama puede ver, o None.

    El cliente, como en su lista (`toJson`): no cancelada y de una empresa con
    vehículo. Un admin, cualquiera no cancelada.
    """
    if not isinstance(quotation_id, int) or isinstance(quotation_id, bool):
        return None
    quotation = db.session.get(Quotations, quotation_id)
    if quotation is None or quotation.order_id != order.id:
        return None
    if quotation.quotation_status_id == QuotationStatus.Cancelled():
        return None
    if not internal and not quotation.carrier_company.vehicles:
        return None
    return quotation


def _filename(row):
    name = unicodedata.normalize('NFKD', row.business_name).encode('ascii', 'ignore').decode()
    name = re.sub(r'[^A-Za-z0-9]+', '_', name).strip('_')[:60] or 'Cliente'
    return f'Cotizacion_{name}_{row.order_id}_Chalan.pdf'


def _pdf_response(row, pdf):
    return Response(pdf, mimetype='application/pdf', headers={
        'Content-Disposition': f'attachment; filename="{_filename(row)}"',
        'X-Formal-Quotation-Id': str(row.id),
        'Access-Control-Expose-Headers': 'Content-Disposition, X-Formal-Quotation-Id',
    })


def _summary(row):
    return {
        'id': row.id,
        'order_id': row.order_id,
        'quotation_id': row.quotation_id,
        'ruc': row.ruc,
        'business_name': row.business_name,
        'contact_name': row.contact_name,
        'contact_email': row.contact_email,
        'prices_include_igv': row.prices_include_igv,
        'subtotal': float(row.subtotal),
        'igv': float(row.igv),
        'total': float(row.total),
        'valid_until': row.valid_until.isoformat(),
        'created_by_admin_id': row.created_by_admin_id,
        'created_date': row.created_date.isoformat() if row.created_date else None,
    }


def _bool(data, key, default):
    value = data.get(key)
    return value if isinstance(value, bool) else default


def _build(order, quotation, client, prices_include_igv, include_reservation):
    breakdown = OrderEntity.reservation_breakdown(quotation)
    reservation_paid = Payment.query.filter_by(
        order_id=order.id, quotation_id=quotation.id, concept='reservation', status='paid',
    ).first() is not None
    vehicles = quotation.carrier_company.vehicles
    return build_document(
        order=order,
        origin=order.order_details.filter_by(type='carry_from').first(),
        destination=order.order_details.filter_by(type='deliver_to').first(),
        vehicle=vehicles[0] if vehicles else None,
        service_names=[s.service.service for s in order.services if s.service],
        client=client,
        price=breakdown['total'],
        reservation_amount=breakdown['reservation_amount'],
        reservation_paid=reservation_paid,
        include_reservation=include_reservation,
        prices_include_igv=prices_include_igv,
        issued_on=datetime.now(LIMA).date(),
        cargo_weight_label=CARGO_WEIGHT_LABELS.get(order.cargo_weight_kg),
    )


def _email(row, pdf):
    """Al correo que dejó el cliente, con copia a Chalán: es un cliente empresa."""
    totals = row.document['totals']
    send_email(
        row.contact_email,
        f'Cotización formal – Orden N.° {row.order_id}',
        'email/formal_quotation',
        [os.getenv('ADMIN_MAIL')] if os.getenv('ADMIN_MAIL') else [],
        attachments=[(_filename(row), 'application/pdf', pdf)],
        order_id=row.order_id,
        contact_name=row.contact_name,
        business_name=row.business_name,
        ruc=row.ruc,
        total=money_label(totals['total']),
        valid_until=long_date(row.valid_until),
        issuer_email=issuer.EMAIL,
        issuer_phone=issuer.PHONE,
    )


@api.route('/order/<int:order_id>/formal-quotations', methods=['POST'])
def create_formal_quotation(order_id):
    order = db.session.get(Order, order_id)
    role, customer_or_error = _caller(order)
    if role is None:
        return customer_or_error
    if order is None:
        return _error(404, 'order not found')
    internal = role == 'internal'
    if not internal and order.order_status_id == OrderStatus.cancelled():
        return _error(409, 'order cancelled')

    data = request.get_json(silent=True) or {}
    quotation = _visible_quotation(order, data.get('quotation_id'), internal)
    if quotation is None:
        return _error(404, 'quotation not found', 'quotation_id')
    try:
        client = parse_client(data)
    except InvalidClient as error:
        return _error(400, error.message, error.field)

    # Las dos opciones son del backoffice: el cliente siempre recibe el precio
    # sin IGV (18 % encima) y el adelanto que pide la web.
    prices_include_igv = _bool(data, 'prices_include_igv', False) if internal else False
    include_reservation = (_bool(data, 'include_reservation', yape_reservation_required()) if internal
                           else yape_reservation_required())
    admin_id = data.get('admin_user_id') if internal and isinstance(data.get('admin_user_id'), int) else None

    document = _build(order, quotation, client, prices_include_igv, include_reservation)
    totals = document['totals']

    # El cliente que vuelve a pedirla con los mismos datos actualiza la suya en
    # vez de sumar filas y correos (p. ej. al tocar el botón dos veces).
    row = None
    previous_email = None
    if not internal:
        row = FormalQuotation.query.filter_by(
            order_id=order.id, quotation_id=quotation.id, ruc=client['ruc'], created_by_admin_id=None,
        ).order_by(FormalQuotation.id.desc()).first()
        previous_email = row.contact_email if row else None
    if row is None:
        row = FormalQuotation(order_id=order.id, quotation_id=quotation.id)
        db.session.add(row)
    row.customer_id = order.customer_id
    row.ruc = client['ruc']
    row.business_name = client['business_name']
    row.contact_name = client['contact_name'] or None
    row.contact_email = client['contact_email'] or None
    row.prices_include_igv = prices_include_igv
    row.subtotal = totals['subtotal']
    row.igv = totals['igv']
    row.total = totals['total']
    row.valid_until = datetime.fromisoformat(document['valid_until']).date()
    row.document = document
    row.created_by_admin_id = admin_id
    db.session.flush()
    sync_accounting_note(order)
    db.session.commit()

    pdf = render_pdf(document)
    if not internal and row.contact_email and row.contact_email != previous_email:
        _email(row, pdf)
    return _pdf_response(row, pdf)


@api.route('/order/<int:order_id>/formal-quotations', methods=['GET'])
def list_formal_quotations(order_id):
    order = db.session.get(Order, order_id)
    role, customer_or_error = _caller(order)
    if role is None:
        return customer_or_error
    if order is None:
        return _error(404, 'order not found')

    rows = FormalQuotation.query.filter_by(order_id=order.id).order_by(FormalQuotation.id.desc()).all()
    last = None
    if order.customer_id:
        last = FormalQuotation.query.filter_by(customer_id=order.customer_id) \
            .order_by(FormalQuotation.id.desc()).first()
    body = {
        'formal_quotations': [_summary(row) for row in rows],
        'last_client': {
            'ruc': last.ruc,
            'business_name': last.business_name,
            'contact_name': last.contact_name,
            'contact_email': last.contact_email,
        } if last else None,
        'include_reservation_default': yape_reservation_required(),
    }
    if role == 'internal':
        quotations = order.quotations.filter(
            Quotations.quotation_status_id != QuotationStatus.Cancelled()).order_by(Quotations.id).all()
        body['quotations'] = [{
            'id': q.id,
            'carrier_company_name': q.carrier_company.name if q.carrier_company else None,
            'amount': q.amount,
            'total_amount': OrderEntity.reservation_breakdown(q)['total'],
            'selected': q.quotation_status_id == QuotationStatus.Selected(),
        } for q in quotations]
    return jsonify(body), 200


@api.route('/formal-quotations/<int:formal_quotation_id>/pdf', methods=['GET'])
def formal_quotation_pdf(formal_quotation_id):
    row = db.session.get(FormalQuotation, formal_quotation_id)
    order = db.session.get(Order, row.order_id) if row else None
    role, customer_or_error = _caller(order)
    if role is None:
        return customer_or_error
    if row is None:
        return _error(404, 'formal quotation not found')
    return _pdf_response(row, render_pdf(row.document))
