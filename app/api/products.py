import os
from flask import jsonify, request
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
    products = product.get_active_products(filters)

    if len(products) == 0:
        send_email(customer.email, 'Siguientes pasos para tu mudanza',
                   'email/no_product', bcc=[], customer=customer)
        last_order = customer.orders.order_by(Order.id.desc()).first()
        send_email(os.getenv('ADMIN_MAIL'), 'Orden id {} sin vehículo'.format(last_order.id),
                   'email/admin_new_order', bcc=[], order=last_order, mobile_phone=customer.mobile_phone)

    return jsonify(products)