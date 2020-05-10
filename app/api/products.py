from flask import jsonify, request
from . import api
from .product import Product as ProductEntity

@api.route('/products', methods=['GET'])
def get_products():
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

    return jsonify(products)