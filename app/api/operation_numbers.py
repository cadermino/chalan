"""El número de operación de Yape que informa el cliente al reservar.

Lo comparten las mudanzas (payments) y las solicitudes de servicio
(service_request_payments): un mismo yapeo no puede reservar dos cosas, sea
del tipo que sea.
"""
from .. import db
from ..models import Payment, ServiceRequestPayment

# Largo del número de operación de Yape que aceptamos. No conocemos el formato
# exacto del comprobante, así que el rango es ancho a propósito: sirve para
# descartar vacíos y basura, no para validar contra Yape.
OPERATION_NUMBER_MIN_LENGTH = 4
OPERATION_NUMBER_MAX_LENGTH = 20


def clean_operation_number(raw):
    """Solo los dígitos del número de operación, o '' si no vino nada usable."""
    return ''.join(ch for ch in str(raw or '') if ch.isdigit())


def is_valid_operation_number(number):
    return OPERATION_NUMBER_MIN_LENGTH <= len(number) <= OPERATION_NUMBER_MAX_LENGTH


def operation_number_in_use(reference, order_id=None, service_request_id=None):
    """True si otra reserva viva ya usó este número. Las canceladas no cuentan:
    el número queda libre si esa orden o solicitud se cayó. Se excluye la propia
    (order_id o service_request_id), que puede estar corrigiendo el suyo."""
    order_query = Payment.query.filter(
        Payment.concept == 'reservation',
        Payment.status != 'cancelled',
        Payment.reference == reference,
    )
    if order_id is not None:
        order_query = order_query.filter(Payment.order_id != order_id)
    service_query = ServiceRequestPayment.query.filter(
        ServiceRequestPayment.concept == 'reservation',
        ServiceRequestPayment.status != 'cancelled',
        ServiceRequestPayment.reference == reference,
    )
    if service_request_id is not None:
        service_query = service_query.filter(ServiceRequestPayment.service_request_id != service_request_id)
    return db.session.query(order_query.exists()).scalar() or db.session.query(service_query.exists()).scalar()
