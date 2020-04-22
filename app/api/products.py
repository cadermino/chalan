from flask import jsonify, request
from . import api
from .product import Product as ProductEntity

@api.route('/products', methods=['GET'])
def get_products():
    filters = {
        'from_floor': request.args.get('from_floor'),
        'to_floor': request.args.get('to_floor'),
        'from_state': request.args.get('from_state'),
        'to_state': request.args.get('to_state')
    }
    product = ProductEntity()
    products = product.get_active_products(filters)

    return jsonify(products)