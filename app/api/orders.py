from flask import jsonify, request, g, url_for, current_app
from .. import db
from ..models import Customer
from . import api
from .decorators import token_required

@api.route('/order/create', methods=['POST'])
@token_required
def create_order():
    return jsonify({'message': 'order created!'})
    # customer = Customer.from_json(request.json)
    post.author = g.current_user
    db.session.add(customer)
    db.session.commit()
    return jsonify(customer.to_json()), 201