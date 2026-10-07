import os
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from ... import db
from ...models import (CarrierCompany, ServiceRequest, ServiceRequestCarrierDecline,
                       ServiceRequestQuotation)
from .validation import InvalidRequest

MAX_AMOUNT = Decimal('100000')
MAX_NOTE = 500
CENTS = Decimal('0.01')


class QuotationError(Exception):
    """Un 404 o 409 del flujo de cotizar; la ruta lo devuelve con su codigo."""

    def __init__(self, message, status):
        super().__init__(message)
        self.status = status


def parse_amount(value):
    """Monto del transportista: numero (o texto numerico) mayor que 0 y hasta
    100000, redondeado a 2 decimales. Es el precio tal cual; la comision nunca
    se le suma aca."""
    message = 'amount must be a number between 0 and 100000'
    if isinstance(value, bool) or value is None:
        raise InvalidRequest(message)
    try:
        amount = Decimal(str(value).strip())
    except InvalidOperation:
        raise InvalidRequest(message)
    if not amount.is_finite():
        raise InvalidRequest(message)
    amount = amount.quantize(CENTS, rounding=ROUND_HALF_UP)
    if not Decimal('0') < amount <= MAX_AMOUNT:
        raise InvalidRequest(message)
    return amount


def parse_note(value):
    if value is None:
        return None
    if not isinstance(value, str):
        raise InvalidRequest('note must be text')
    note = value.strip()
    if len(note) > MAX_NOTE:
        raise InvalidRequest(f'note is too long (max {MAX_NOTE})')
    return note or None


def platform_fee_rate():
    """La comision vigente. Sin default a proposito: congelar un total con una
    tasa inventada es peor que fallar, y asi se comporta el resto del API."""
    raw = os.getenv('PLATFORM_FEE')
    if raw is None:
        raise RuntimeError('PLATFORM_FEE is not set')
    return Decimal(raw)


def total_with_fee(amount, rate):
    """Total para el cliente: monto + comision, a 2 decimales. Misma formula que
    las mudanzas: amount * (1 + PLATFORM_FEE)."""
    return (Decimal(amount) * (1 + Decimal(rate))).quantize(CENTS, rounding=ROUND_HALF_UP)


def _lock_request(service_request_id):
    # Bloqueada para que dos cotizaciones o dos elecciones a la vez no se pisen.
    service_request = (
        ServiceRequest.query.filter_by(id=service_request_id).with_for_update().first()
    )
    if service_request is None:
        raise QuotationError('service request not found', 404)
    if service_request.status == 'draft':
        raise QuotationError('service request was not sent yet', 409)
    if service_request.status == 'cancelled':
        raise QuotationError('service request was cancelled', 409)
    return service_request


def save_quotation(service_request_id, carrier_company_id, amount, note):
    """Crea o actualiza la cotizacion de un transportista. Devuelve (cotizacion, creada)."""
    service_request = _lock_request(service_request_id)
    if db.session.get(CarrierCompany, carrier_company_id) is None:
        raise QuotationError('carrier company not found', 404)

    selected = next((q for q in service_request.quotations if q.status == 'selected'), None)
    if selected is not None:
        # Con una elegida el precio quedo acordado: ni la propia se cambia por
        # detras, ni otra empresa entra (mismo criterio que las mudanzas).
        if selected.carrier_company_id == carrier_company_id:
            raise QuotationError('quotation already selected', 409)
        raise QuotationError('service request already assigned', 409)

    quotation = next(
        (q for q in service_request.quotations if q.carrier_company_id == carrier_company_id), None)
    created = quotation is None
    if created:
        quotation = ServiceRequestQuotation(
            service_request_id=service_request.id, carrier_company_id=carrier_company_id)
        db.session.add(quotation)
    quotation.amount = amount
    quotation.note = note
    # Cotizar despues de haber rechazado deja sin efecto el rechazo.
    ServiceRequestCarrierDecline.query.filter_by(
        service_request_id=service_request.id, carrier_company_id=carrier_company_id).delete()
    db.session.commit()
    return quotation, created


def _unfreeze(quotation):
    quotation.status = 'active'
    quotation.platform_fee_rate = None
    quotation.total_amount = None
    quotation.selected_at = None
    quotation.selected_by_admin_id = None


def select_quotation(service_request_id, quotation_id, admin_user_id):
    """El admin elige una cotizacion. Congela la comision y el total de ese momento:
    si PLATFORM_FEE cambia despues, lo acordado con el cliente no se mueve."""
    service_request = _lock_request(service_request_id)
    quotation = next((q for q in service_request.quotations if q.id == quotation_id), None)
    if quotation is None:
        raise QuotationError('quotation not found', 404)
    if quotation.status == 'selected':
        return quotation  # idempotente: no cambia selected_at

    rate = platform_fee_rate()
    for other in service_request.quotations:
        if other.status == 'selected':
            _unfreeze(other)
    quotation.status = 'selected'
    quotation.platform_fee_rate = rate.quantize(Decimal('0.0001'))
    quotation.total_amount = total_with_fee(quotation.amount, rate)
    quotation.selected_at = datetime.utcnow()
    quotation.selected_by_admin_id = admin_user_id
    db.session.commit()
    return quotation
