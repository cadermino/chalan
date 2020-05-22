import stripe
from flask import jsonify, request, current_app
from ..models import Customer, Order, OrderSchema
from . import api
from .decorators import token_required
from .order import Order as OrderEntity

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
    order = OrderEntity(order_id)
    payment = order.create_cash_payment()

    return jsonify({
        'payment': payment.id,
    }), 200