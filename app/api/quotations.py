from flask import jsonify, request
from . import api
from .quotation import Quotation as QuoationEntity
from ..models import Customer
from .decorators import token_required

@api.route('/quotations/<int:order_id>', methods=['GET'])
@token_required
def get_quotations(order_id):
    auth_headers = request.headers.get('Authorization', '').split()
    Customer.verify_auth_token(auth_headers[1])
    quotations = QuoationEntity().listByOrderId(order_id).toJson()
    return quotations, 200

@api.route('/quotation/<int:quotation_id>', methods=['PUT'])
@token_required
def pick_quotation(quotation_id):
    auth_headers = request.headers.get('Authorization', '').split()
    Customer.verify_auth_token(auth_headers[1])
    QuoationEntity(quotation_id).pickQuotation()
    return jsonify({
        'quotation_id': quotation_id
    }), 200