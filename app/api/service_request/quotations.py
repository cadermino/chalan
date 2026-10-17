import os
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from ... import db
from ...models import (CarrierCompany, ServiceRequest, ServiceRequestCarrierDecline,
                       ServiceRequestPayment, ServiceRequestQuotation)
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


def select_quotation(service_request_id, quotation_id, admin_user_id, replace=True):
    """Elige una cotizacion: el admin (admin_user_id) o el cliente (None). Congela la
    comision y el total de ese momento: si PLATFORM_FEE cambia despues, lo acordado
    con el cliente no se mueve.

    El admin puede cambiar la elegida; el cliente no (replace=False): una vez
    elegida ya se le avisó al transportista, y cambiarla es cosa de hablarlo."""
    service_request = _lock_request(service_request_id)
    quotation = next((q for q in service_request.quotations if q.id == quotation_id), None)
    if quotation is None:
        raise QuotationError('quotation not found', 404)
    if quotation.status == 'selected':
        return quotation  # idempotente: no cambia selected_at
    if not replace and any(q.status == 'selected' for q in service_request.quotations):
        raise QuotationError('another quotation was already selected', 409)

    rate = platform_fee_rate()
    for other in service_request.quotations:
        if other.status == 'selected':
            _unfreeze(other)
    # Una reserva por verificar de otra cotización deja de valer: el admin
    # cambió la elegida. Una ya pagada no se toca (esa plata hay que verla aparte).
    for payment in service_request.payments:
        if payment.status == 'pending' and payment.service_request_quotation_id != quotation.id:
            payment.status = 'cancelled'
    quotation.status = 'selected'
    quotation.platform_fee_rate = rate.quantize(Decimal('0.0001'))
    quotation.total_amount = total_with_fee(quotation.amount, rate)
    quotation.selected_at = datetime.utcnow()
    quotation.selected_by_admin_id = admin_user_id
    db.session.commit()
    return quotation


def split_total(quotation, rate):
    """(total, reserva, en el lugar): el total para el cliente, lo que le yapea a
    Chalán para agendar (la comisión) y lo que le paga al transportista el día
    del servicio (su precio tal cual). Una elegida usa su total congelado."""
    if quotation.status == 'selected' and quotation.total_amount is not None:
        total = Decimal(quotation.total_amount)
    else:
        total = total_with_fee(quotation.amount, rate)
    on_site = Decimal(quotation.amount)
    return total, total - on_site, on_site


def live_reservation(service_request, quotation_id):
    """La reserva por verificar o ya pagada de esa cotización, o None."""
    return next((p for p in reversed(service_request.payments)
                 if p.service_request_quotation_id == quotation_id and p.status != 'cancelled'), None)


def record_reservation(service_request, quotation, reference):
    """Guarda la reserva que el cliente dice haber yapeado. Devuelve (reserva, creada).

    Si ya había una por verificar para esta cotización, el cliente está
    corrigiendo el número. Una ya confirmada por un admin no se reescribe: quedó
    verificada contra ese número."""
    reservation = live_reservation(service_request, quotation.id)
    if reservation is not None:
        if reservation.status == 'pending' and reservation.reference != reference:
            reservation.reference = reference
            db.session.commit()
        return reservation, False
    _, amount, _ = split_total(quotation, quotation.platform_fee_rate)
    reservation = ServiceRequestPayment(
        service_request_id=service_request.id, service_request_quotation_id=quotation.id,
        amount=amount, reference=reference)
    db.session.add(reservation)
    db.session.commit()
    return reservation, True


def resolve_reservation(service_request_id, payment_id, status, admin_user_id):
    """El admin dice si encontró el yapeo (paid) o no (cancelled). Solo desde
    pending. Si no llegó y la cotización la había elegido el cliente, se libera
    la elección para que pueda volver a elegir (y a yapear)."""
    service_request = _lock_request(service_request_id)
    payment = next((p for p in service_request.payments if p.id == payment_id), None)
    if payment is None:
        raise QuotationError('payment not found', 404)
    if payment.status != 'pending':
        raise QuotationError('payment is not pending', 409)
    if status == 'paid':
        payment.status = 'paid'
        payment.paid_at = datetime.utcnow()
        payment.confirmed_by_admin_id = admin_user_id
    else:
        payment.status = 'cancelled'
        quotation = db.session.get(ServiceRequestQuotation, payment.service_request_quotation_id)
        if quotation is not None and quotation.status == 'selected' and quotation.selected_by_admin_id is None:
            _unfreeze(quotation)
    db.session.commit()
    return payment
