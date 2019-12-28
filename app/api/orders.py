from flask import jsonify, request, g, url_for, current_app
from .. import db
from ..models import Customer, Order, OrderDetails, OrderSchema
from . import api
from .decorators import token_required

@api.route('/order/create', methods=['POST'])
@token_required
def create_order(*args, **kwargs):
    customer = kwargs['customer_data']
    order_data = request.json
    order = Order(
        customer_id = customer.id,
        driver_id = order_data['driver_id'],
        appointment_date = order_data['appointment_date'],
        comments = order_data['comments']
    )
    db.session.add(order)
    db.session.commit()
    order_details_from = OrderDetails(
        type = 'carry_from',
        floor_number = order_data['from_floor_number'],
        order_id = order.id,
        street = order_data['from_street'],
        interior_number = order_data['from_interior_number'],
        neighborhood = order_data['from_neighborhood'],
        city = order_data['from_city'],
        state = order_data['from_state'],
        zip_code = order_data['from_zip_code'],
    )
    order_details_to = OrderDetails(
        type = 'deliver_to',
        floor_number = order_data['to_floor_number'],
        order_id = order.id,
        street = order_data['to_street'],
        interior_number = order_data['to_interior_number'],
        neighborhood = order_data['to_neighborhood'],
        city = order_data['to_city'],
        state = order_data['to_state'],
        zip_code = order_data['to_zip_code'],
    )
    db.session.add(order_details_from)
    db.session.add(order_details_to)
    db.session.commit()
    return jsonify({'message': 'order {id} created!'.format(id=order.id)}), 201

@api.route('/orders', methods=['GET'])
@token_required
def all_orders(*args, **kwargs):
    orders = Order.query.all()
    order_schema = OrderSchema(many=True)
    output = order_schema.dump(orders)
    return jsonify({'orders': output})