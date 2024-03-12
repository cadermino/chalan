from flask import jsonify, request
from . import api
from .quotation import Quotation as QuotationEntity
from .decorators import token_required, carrier_company_token_required
from .carrier_company import CarrierCompany as CarrierCompanyEntity
from ..models import Customer

@api.route('/quotations/<int:order_id>', methods=['GET'])
@token_required
def get_quotations(order_id):
    auth_headers = request.headers.get('Authorization', '').split()
    Customer.verify_auth_token(auth_headers[1])
    quotations = QuotationEntity().listByOrderId(order_id).toJson()
    return quotations, 200

@api.route('/quotation/<int:quotation_id>', methods=['PUT'])
@token_required
def pick_quotation(quotation_id):
    auth_headers = request.headers.get('Authorization', '').split()
    Customer.verify_auth_token(auth_headers[1])
    QuotationEntity(quotation_id).pickQuotation()
    return jsonify({
        'quotation_id': quotation_id
    }), 200

@api.route('/quotations', methods=['POST'])
@carrier_company_token_required
def create_quotation():
    quotation_data = request.json
    auth_headers = request.headers.get('Authorization', '').split()
    token_data = CarrierCompanyEntity.verify_carrier_company_token(auth_headers[1])
    order_id = token_data['order_id']
    carrier_company_id = token_data['carrier_company_id']
    data = {
        'amount': quotation_data['amount'],
        'order_id': order_id,
        'carrier_company_id': carrier_company_id,
    }
    previous_quotation = QuotationEntity().get(order_id, carrier_company_id)
    if previous_quotation is None:
        quotation = QuotationEntity().create(data)
        return jsonify({
            'message': 'quotation {id} created!'.format(id=quotation.id),
            'quotation_id': quotation.id,
            'amount': quotation.amount
        }), 201

    return jsonify({
        'message': 'quotation {id} found!'.format(id=previous_quotation.id),
        'quotation_id': previous_quotation.id,
        'amount': previous_quotation.amount
    }), 200