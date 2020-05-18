from flask import jsonify, request
from ..models import Customer, CustomerSchema
from . import api
from .decorators import token_required
from .. import db

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