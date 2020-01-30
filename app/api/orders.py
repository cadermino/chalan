from flask import jsonify, request, g, url_for, current_app
from .. import db
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
        'message': 'order {id} created!'.format(id=order.id),
        'order_id': order.id
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

# @api.route('/order/<int:order_id>/payment', methods=['POST'])
# @token_required
# def order_payment(order_id):
#     auth_headers = request.headers.get('Authorization', '').split()
#     customer = Customer.verify_auth_token(auth_headers[1])
#     print('create_order_customer function')
#     print(request)
#     return 'True'

@api.route('/orders', methods=['GET'])
@token_required
def all_orders():
    orders = Order.query.all()
    order_schema = OrderSchema(many=True)
    output = order_schema.dump(orders)
    return jsonify({'orders': output})