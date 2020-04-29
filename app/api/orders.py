import stripe
from flask import jsonify, request, current_app
from ..models import Customer, Order, OrderSchema
from . import api
from .decorators import token_required
from .order import Order as OrderEntity

@api.route('/order/create', methods=['POST'])
def create_order():
    order_data = request.json
    order = OrderEntity()
    order = order.create(order_data=order_data)
    return jsonify({
        'message': 'order {id} created!'.format(id=order[0].id),
        'order_id': order[0].id,
        'is_out_of_range': order[1]
    }), 201

@api.route('/order/<int:order_id>/update', methods=['POST'])
def update_order(order_id):
    order_data = request.json
    order = OrderEntity(order_id)
    order = order.update(order_data=order_data)
    return jsonify({
        'message': 'order {id} updated!'.format(id=order.id),
        'order_id': order.id
    }), 200

@api.route('/orders', methods=['GET'])
@token_required
def all_orders():
    orders = Order.query.all()
    order_schema = OrderSchema(many=True)
    output = order_schema.dump(orders)
    return jsonify({'orders': output})

@api.route('/order/checkout', methods=['GET'])
@token_required
def generate_checkout_session():
    stripe.api_key = current_app.config['STRIPE_SECRET_KEY']
    session = stripe.checkout.Session.create(
        customer_email = request.args.get('customer_email'),
        client_reference_id = request.args.get('client_reference_id'),
        locale = 'es',
        success_url = current_app.config['STRIPE_SUCCESS'],
        cancel_url = current_app.config['STRIPE_CANCEL'],
        payment_method_types = ["card"],
        line_items = [
            {
                'name': request.args.get('name'),
                'description': request.args.get('description'),
                'amount': request.args.get('amount'),
                'currency': 'mxn',
                'quantity': 1,
            }
        ],
    )

    return session