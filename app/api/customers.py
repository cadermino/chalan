import os
from flask import jsonify, request
from . import api
from .quotation.quotation_status import QuotationStatus
from .order.order_status import OrderStatus
from .order import Order as OrderEntity
from .decorators import token_required, authenticated_customer
from .whatsapp import normalize_phone
from ..models import AdminUser, Customer, Order, Payment, Quotations, ReferredOrder
from .. import db

@api.route('/customer/<int:customer_id>', methods=['PATCH'])
@token_required
def update_customer(customer_id):
    auth_headers = request.headers.get('Authorization', '').split()
    customer = Customer.verify_auth_token(auth_headers[1])
    customer_data = request.json
    try:
        customer_data['id']
        return {}, 401
    except:
        for column in customer_data:
            if getattr(customer, column) != customer_data[column]:
                setattr(customer, column, customer_data[column])
                db.session.add(customer)
                db.session.commit()

        return {}, 204

@api.route('/customer/<int:customer_id>/last-pending-order', methods=['GET'])
@token_required
def customer_last_pending_order(customer_id):
    auth_headers = request.headers.get('Authorization', '').split()
    customer = Customer.verify_auth_token(auth_headers[1])
    order = customer.orders.filter(
        Order.order_status_id.in_([OrderStatus.pending(), OrderStatus.in_progress()])
    ).order_by(Order.id.desc()).first()
    if order is None:
        return jsonify({'order': None}), 200
    order_detail = OrderEntity(order.id).details()
    return jsonify({'order': order_detail}), 200

ORDER_STATUS_NAMES = {
    OrderStatus.pending(): 'pending',
    OrderStatus.in_progress(): 'in_progress',
    OrderStatus.completed(): 'completed',
    OrderStatus.cancelled(): 'cancelled',
}


def _latest_payment(order, quotation, concept):
    """El último movimiento vivo de ese concepto para la cotización elegida."""
    return order.payments.filter(
        Payment.concept == concept,
        Payment.status != 'cancelled',
        db.or_(Payment.quotation_id == quotation.id, Payment.quotation_id.is_(None)),
    ).order_by(Payment.id.desc()).first()


def _booking(order, quotation):
    """Lo que el panel muestra de una mudanza con cotización elegida.

    Como en la página de cotizaciones de servicios: el total, cuánto queda por
    pagarle al transportista el día de la mudanza, la reserva yapeada y, solo
    con la mudanza confirmada (en curso o completada), el WhatsApp del
    transportista. Mientras se verifica el yapeo el transportista todavía no
    recibió el pedido, así que su contacto no se muestra.
    """
    breakdown = OrderEntity.reservation_breakdown(quotation)
    reservation = _latest_payment(order, quotation, 'reservation')
    carrier_cash = _latest_payment(order, quotation, 'carrier_cash')
    company = quotation.carrier_company
    contact = None
    if order.order_status_id in (OrderStatus.in_progress(), OrderStatus.completed()):
        e164 = normalize_phone(company.phone)
        contact = {
            'name': company.name,
            'phone': company.phone,
            'whatsapp_url': 'https://wa.me/' + e164.lstrip('+') if e164 else None,
        }
    return {
        'carrier_company_id': company.id,
        'total_amount': breakdown['total'],
        'carrier_amount': breakdown['carrier_amount'],
        'reservation': {
            'amount': reservation.amount,
            'status': reservation.status,
            'reference': reservation.reference,
        } if reservation else None,
        'carrier_cash_status': carrier_cash.status if carrier_cash else None,
        'carrier_contact': contact,
    }


@api.route('/customer/<int:customer_id>/orders', methods=['GET'])
@token_required
def customer_orders(customer_id):
    # token_required solo valida el token, no de quién es: con cualquier sesión
    # se leía el último pedido de otro cliente cambiando el número de la URL.
    authenticated = authenticated_customer()
    if authenticated is None or authenticated.id != customer_id:
        return jsonify({'message': 'forbidden'}), 403
    order = Order.query.\
        filter_by(customer_id = customer_id).order_by(Order.id.desc()).first()
    if order is None:
        return jsonify([]), 200
    quotation = order.quotations.filter(Quotations.quotation_status_id == QuotationStatus.Selected()).first()
    try:
        # El cliente ve el monto con fee de plataforma (y comisión del agente,
        # si la orden viene referida) en el paso tres y en el modal de
        # confirmación, porque Quotation.toJson lo suma ahí. Devolver
        # quotation.amount en crudo hacía que el dashboard mostrara menos de
        # lo que la persona acababa de aceptar.
        platform_fee = float(os.getenv('PLATFORM_FEE'))
        commission_rate = 0
        referred = ReferredOrder.query.filter_by(order_id=order.id).first()
        if referred:
            agent = db.session.get(AdminUser, referred.admin_user_id)
            commission_rate = agent.commission_rate
        amount = round(quotation.amount * (1 + commission_rate + platform_fee), 2)
    except:
        amount = '-'
    try:
        # El badge del dashboard habla del pago del servicio, no de la reserva:
        # se apunta al movimiento del transportista. El fallback por id cubre
        # las filas anteriores a la migración 016, que no tienen concept.
        payment_status = order.payments.filter(
            Payment.concept == 'carrier_cash'
        ).order_by(Payment.id.desc()).first().status
    except:
        try:
            payment_status = order.payments.order_by(Payment.id.desc()).first().status
        except:
            payment_status = 'pending'
    try:
        appointment_date = order.appointment_date.isoformat()
    except:
        appointment_date = '-'
    orders_datils = {
        'order_id': order.id,
        'status': ORDER_STATUS_NAMES.get(order.order_status_id, 'pending'),
        'appointment_date': appointment_date,
        'carrier_company_name': quotation.carrier_company.name if quotation else '-',
        'amount': amount,
        'payment_status': payment_status
    }
    if quotation is not None:
        orders_datils.update(_booking(order, quotation))

    return jsonify([orders_datils]), 200