from flask import jsonify, request, g, url_for, current_app
from .. import db
from ..models import Customer, CustomerSchema
from . import api
from .decorators import token_required

@api.route('/customers', methods=['GET'])
@token_required
def all_customers(*args, **kwargs):
    customers = Customer.query.all()
    customer_schema = CustomerSchema(many=True)
    output = customer_schema.dump(customers)
    return jsonify({'customers': output})