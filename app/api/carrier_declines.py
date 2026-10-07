"""El transportista avisa que no puede hacer una mudanza o una solicitud de servicio.

Antes simplemente no respondia, y Chalan no distinguia "no lo vio" de "no puede".
El rechazo lleva un motivo y se puede deshacer mientras siga abierto; cotizar
despues tambien lo borra.

Rechazar retira la cotizacion que el transportista tuviera viva: si no, el
cliente seguiria viendo un precio de alguien que ya dijo que no. Si ya lo
eligieron no se puede rechazar desde el link: eso se habla con Chalan.
"""
from .. import db
from ..models import (CarrierCompany, Order, OrderCarrierDecline, Quotations,
                      ServiceRequestCarrierDecline)
from .order.order_status import OrderStatus
from .quotation.quotation_status import QuotationStatus
from .service_request.quotations import QuotationError, _lock_request
from .service_request.validation import InvalidRequest

REASONS = ('date_unavailable', 'zone', 'vehicle', 'budget', 'other')
MAX_NOTE = 500


def parse_decline(data):
    """(motivo, nota) del cuerpo. Con 'other' la nota es obligatoria: sin ella el
    motivo no dice nada."""
    reason = data.get('reason')
    if reason not in REASONS:
        raise InvalidRequest('reason must be one of: ' + ', '.join(REASONS))
    note = data.get('note')
    if note is not None:
        if not isinstance(note, str):
            raise InvalidRequest('note must be text')
        note = note.strip() or None
        if note and len(note) > MAX_NOTE:
            raise InvalidRequest(f'note is too long (max {MAX_NOTE})')
    if reason == 'other' and not note:
        raise InvalidRequest('note is required when reason is other')
    return reason, note


def decline_to_dict(decline):
    if decline is None:
        return None
    return {
        'reason': decline.reason,
        'note': decline.note,
        'created_date': decline.created_date.isoformat() + '+00:00' if decline.created_date else None,
        'updated_date': decline.updated_date.isoformat() + '+00:00' if decline.updated_date else None,
    }


def _check_carrier(carrier_company_id):
    if db.session.get(CarrierCompany, carrier_company_id) is None:
        raise QuotationError('carrier company not found', 404)


def _lock_pending_order(order_id):
    # Bloqueada para que rechazar y cotizar (o elegir) a la vez no se pisen.
    order = Order.query.filter_by(id=order_id).with_for_update().first()
    if order is None:
        raise QuotationError('order not found', 404)
    if order.order_status_id != OrderStatus.pending():
        raise QuotationError('order is not awaiting quotations', 409)
    return order


def find_order_decline(order_id, carrier_company_id):
    return OrderCarrierDecline.query.filter_by(
        order_id=order_id, carrier_company_id=carrier_company_id).first()


def decline_order(order_id, carrier_company_id, reason, note):
    """Registra (o actualiza) el rechazo. Devuelve (rechazo, retiro_una_cotizacion)."""
    _lock_pending_order(order_id)
    _check_carrier(carrier_company_id)

    live = Quotations.query.filter(
        Quotations.order_id == order_id,
        Quotations.carrier_company_id == carrier_company_id,
        Quotations.quotation_status_id != QuotationStatus.Cancelled(),
    ).all()
    if any(q.quotation_status_id == QuotationStatus.Selected() for q in live):
        raise QuotationError('quotation already selected', 409)
    for quotation in live:
        quotation.quotation_status_id = QuotationStatus.Cancelled()

    decline = find_order_decline(order_id, carrier_company_id)
    if decline is None:
        decline = OrderCarrierDecline(order_id=order_id, carrier_company_id=carrier_company_id)
        db.session.add(decline)
    decline.reason = reason
    decline.note = note
    db.session.commit()
    return decline, bool(live)


def undo_order_decline(order_id, carrier_company_id):
    """Borra el rechazo. La cotizacion que se retiro no vuelve: se cotiza de nuevo."""
    _lock_pending_order(order_id)
    OrderCarrierDecline.query.filter_by(
        order_id=order_id, carrier_company_id=carrier_company_id).delete()
    db.session.commit()


def clear_order_decline(order_id, carrier_company_id):
    """Cotizar despues de rechazar deja sin efecto el rechazo. No hace commit."""
    OrderCarrierDecline.query.filter_by(
        order_id=order_id, carrier_company_id=carrier_company_id).delete()


def find_service_request_decline(service_request_id, carrier_company_id):
    return ServiceRequestCarrierDecline.query.filter_by(
        service_request_id=service_request_id, carrier_company_id=carrier_company_id).first()


def decline_service_request(service_request_id, carrier_company_id, reason, note):
    """Igual que decline_order, para una solicitud de servicio. Aca la cotizacion
    no tiene estado de cancelada, asi que retirarla es borrarla."""
    service_request = _lock_request(service_request_id)
    _check_carrier(carrier_company_id)

    selected = next((q for q in service_request.quotations if q.status == 'selected'), None)
    if selected is not None:
        if selected.carrier_company_id == carrier_company_id:
            raise QuotationError('quotation already selected', 409)
        raise QuotationError('service request already assigned', 409)

    mine = next(
        (q for q in service_request.quotations if q.carrier_company_id == carrier_company_id), None)
    if mine is not None:
        service_request.quotations.remove(mine)

    decline = find_service_request_decline(service_request.id, carrier_company_id)
    if decline is None:
        decline = ServiceRequestCarrierDecline(
            service_request_id=service_request.id, carrier_company_id=carrier_company_id)
        db.session.add(decline)
    decline.reason = reason
    decline.note = note
    db.session.commit()
    return decline, mine is not None


def undo_service_request_decline(service_request_id, carrier_company_id):
    _lock_request(service_request_id)
    ServiceRequestCarrierDecline.query.filter_by(
        service_request_id=service_request_id, carrier_company_id=carrier_company_id).delete()
    db.session.commit()
