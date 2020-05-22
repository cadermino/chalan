from flask import jsonify, request
from ..models import Customer, CustomerSchema, Order, Payment
from . import api
from .decorators import token_required
from .. import db
# import datetime as dt

@api.route('/customers', methods=['GET'])
@token_required
def all_customers():
    customers = Customer.query.all()
    customer_schema = CustomerSchema(many=True)
    output = customer_schema.dump(customers)
    return jsonify({'customers': output})

@api.route('/customer/<int:customer_id>', methods=['PATCH'])
@token_required
def update_customer(customer_id):
    customer_data = request.json
    customer = Customer.query.get(customer_id)

    for column in customer_data:
        if getattr(customer, column) != customer_data[column]:
            setattr(customer, column, customer_data[column])
            db.session.add(customer)
            db.session.commit()

    return {}, 204

@api.route('/customer/<int:customer_id>/orders', methods=['GET'])
@token_required
def customer_orders(customer_id):
    order = Order.query.\
        filter_by(customer_id = customer_id).order_by(Order.id.desc()).first()
    try:
        payment_status = order.payments.order_by(Payment.id.desc()).first().status
    except:
        payment_status = 'pending'
    try:
        appointment_date = order.appointment_date.isoformat()
    except:
        appointment_date = '-'
    orders_datils = {
        'appointment_date': appointment_date,
        'vehicle_name': '{} {}'.format(order.product.vehicle.brand, order.product.vehicle.model),
        'weight': order.product.vehicle.weight+' kg.',
        'amount': order.product.price,
        'payment_status': payment_status
    }
    order

    return jsonify([orders_datils]), 200