import os
from flask import jsonify, request
from .. import db
from . import api
from .product import Product as ProductEntity
from ..models import Customer, Order
from .decorators import token_required
from .email import send_email

@api.route('/products', methods=['GET'])
@token_required
def get_products():
    auth_headers = request.headers.get('Authorization', '').split()
    customer = Customer.verify_auth_token(auth_headers[1])
    filters = {
        'from_floor': request.args.get('from_floor'),
        'to_floor': request.args.get('to_floor'),
        'from_neighborhood': request.args.get('from_neighborhood'),
        'to_neighborhood': request.args.get('to_neighborhood'),
        'from_city': request.args.get('from_city'),
        'to_city': request.args.get('to_city'),
        'from_state': request.args.get('from_state'),
        'to_state': request.args.get('to_state'),
        'from_zip_code': request.args.get('from_zip_code'),
        'to_zip_code': request.args.get('to_zip_code'),
    }
    product = ProductEntity()
    products = product.generate_products(filters, request.args.get('order_id'))
    if len(products) == 0:
        order = Order.query.get(request.args.get('order_id'))
        order.customer_id = customer.id
        db.session.add(order)
        db.session.commit()
        send_email(customer.email, 'Siguientes pasos para tu mudanza',
                   'email/no_product', bcc=[], customer=customer)
        send_email(os.getenv('ADMIN_MAIL'), 'Orden id {} sin vehículo'.format(order.id),
                   'email/admin_new_order', bcc=[], order=order, mobile_phone=customer.mobile_phone)

    return jsonify(products), 200

@api.route('/product', methods=['POST'])
@token_required
def generate_product():
    product = Order.query.get(request.json['order_id']).product
    product_id = None
    if product is not None:
        product_id = product.id
    data = {
        'product_id': product_id,
        'vehicle_id': request.json['vehicle_id'],
        'price': request.json['price'],
        'active': 1
    }
    product = ProductEntity()
    product = product.create(data)

    return jsonify({
        'id': product.id
    }), 201
    