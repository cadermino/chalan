import os
import stripe
from flask import jsonify, request, current_app
from ..models import Customer, Order, OrderSchema
from . import api
from .decorators import token_required
from .order import Order as OrderEntity
from .email import send_email

@api.route('/order', methods=['POST'])
def create_order():
    order_data = request.json
    order = OrderEntity()
    order = order.create(order_data=order_data)
    return jsonify({
        'message': 'order {id} created!'.format(id=order.id),
        'order_id': order.id,
    }), 201

@api.route('/order/<int:order_id>', methods=['PUT'])
def update_order(order_id):
    order_data = request.json
    order = OrderEntity(order_id)
    order = order.update(order_data=order_data)
    return jsonify({
        'message': 'order {id} updated!'.format(id=order.id),
        'order_id': order.id
    }), 200

@api.route('/order/checkout/<int:order_id>', methods=['PUT'])
@token_required
def generate_checkout_session(order_id):
    auth_headers = request.headers.get('Authorization', '').split()
    customer = Customer.verify_auth_token(auth_headers[1])
    order = customer.orders.order_by(Order.id.desc()).first()
    price = order.product.price * 100
    if price % 1 == 0:
        amount = int(price)
    else:
        amount = price

    stripe.api_key = current_app.config['STRIPE_SECRET_KEY']
    session = stripe.checkout.Session.create(
        customer_email = customer.email,
        client_reference_id = customer.id,
        locale = 'es',
        success_url = current_app.config['STRIPE_SUCCESS'],
        cancel_url = current_app.config['STRIPE_CANCEL'],
        payment_method_types = ["card"],
        line_items = [
            {
                'name': '{} {} {}kg.'.format(order.product.vehicle.brand, order.product.vehicle.model, order.product.vehicle.weight),
                'description': order.product.description,
                'amount': amount,
                'currency': 'mxn',
                'quantity': 1,
            }
        ],
    )
    order = OrderEntity(order.id)
    payment = order.create_stripe_payment(session.id)

    return jsonify({
        'session_id': session.id,
        'payment': payment.id,
    }), 200

@api.route('/order/checkout-cash/<int:order_id>', methods=['PUT'])
@token_required
def generate_checkout_cash(order_id):
    auth_headers = request.headers.get('Authorization', '').split()
    customer = Customer.verify_auth_token(auth_headers[1])
    last_order = customer.orders.order_by(Order.id.desc()).first()
    order = OrderEntity(order_id)
    payment = order.create_cash_payment()
    driver_email = last_order.product.vehicle.carrier_company.email
    
    subject = '[Pago en efectivo] Orden {} '.format(order_id)
    bcc = [os.getenv('ADMIN_MAIL'), driver_email]
    if os.getenv('FLASK_ENV') != 'prod':
        subject = '[test][Pago en efectivo] Orden {} '.format(order_id)
        bcc = [os.getenv('ADMIN_MAIL')]

    send_email(
        os.getenv('ADMIN_MAIL'),
        subject,
        'email/admin_new_order',
        bcc=bcc,
        order=last_order,
        mobile_phone=customer.mobile_phone,
        customer=customer,
        payment_type='cash'
    )
    send_email(
        customer.email,
        'Hemos recibido tu solicitud',
        'email/cash_payment_selected',
        bcc=[],
        customer_name=customer.name,
        mobile_phone=customer.mobile_phone
    )

    return jsonify({
        'payment': payment.id,
    }), 200

@api.route('order/confirm-stripe-payment/<int:order_id>', methods=['PUT'])
@token_required
def confirm_stripe_payment(order_id):
    data = request.json
    auth_headers = request.headers.get('Authorization', '').split()
    customer = Customer.verify_auth_token(auth_headers[1])
    last_order = customer.orders.order_by(Order.id.desc()).first()
    order = OrderEntity(order_id)
    driver_email = last_order.product.vehicle.carrier_company.email

    try:
        payment = order.confirm_stripe_payment(data['session_id'])
        if payment.status == 'paid':
            
            subject = '[Pago con tarjeta] Orden {}'.format(order_id),
            bcc = [os.getenv('ADMIN_MAIL'), driver_email]
            if os.getenv('FLASK_ENV') != 'prod':
                subject = '[test][Pago con tarjeta] Orden {} '.format(order_id)
                bcc = [os.getenv('ADMIN_MAIL')]
            
            send_email(
                os.getenv('ADMIN_MAIL'),
                subject,
                'email/admin_new_order',
                bcc=bcc,
                order=last_order,
                mobile_phone=customer.mobile_phone,
                customer=customer,
                payment_type='card'
            )
            send_email(
                customer.email, 'Tu pago ha sido procesado correctamente',
                'email/stripe_payment_completed',
                bcc=[],
                customer_name=customer.name,
                mobile_phone=customer.mobile_phone
            )
            return jsonify({
                'payment': payment.status,
            }), 200
    except:
        return jsonify({
            'message': 'There was a problem processing the payment.'
        }), 400
