import os
from flask import jsonify, request
from . import api
from .quotation import Quotation as QuotationEntity
from .order import Order as OrderEntity
from .decorators import token_required, carrier_company_token_required
from .carrier_company import CarrierCompany as CarrierCompanyEntity
from ..models import Customer
from .email import send_email

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
    platform_fee = float(os.getenv('PLATFORM_FEE'))
    amount = float(quotation_data['amount']) + (float(quotation_data['amount']) * platform_fee)
    data = {
        'amount': amount,
        'order_id': order_id,
        'carrier_company_id': carrier_company_id,
    }
    previous_quotation = QuotationEntity().get(order_id, carrier_company_id)
    customer = OrderEntity().query_orders({'id': order_id})[0].customers
    if previous_quotation is None:
        quotation = QuotationEntity().create(data)
        message = 'quotation {id} created!'.format(id=quotation.id)
        quotation_id = quotation.id
        quotation_amount = quotation.amount
        quotation_status_id = quotation.quotation_status_id
        status_response = 201

        step_three_url = os.getenv('SITE_URL') + 'order/step-three'
        subject = 'Tienes un nueva cotización para tu mudanza Chalán'
        if os.getenv('FLASK_ENV') != 'prod':
            subject = '[test]Tienes un nueva cotización para tu mudanza Chalán'
        send_email(
            customer.email,
            subject,
            'email/new_quotation_arrived',
            bcc=[os.getenv('ADMIN_MAIL')],
            step_three_url=step_three_url,
            customer_name=customer.name
        )
    else:
        message = 'quotation {id} created!'.format(id=previous_quotation.id)
        quotation_id = previous_quotation.id
        quotation_amount = previous_quotation.amount
        quotation_status_id = previous_quotation.quotation_status_id
        status_response = 200

    return jsonify({
        'message': message,
        'quotation_id': quotation_id,
        'amount': quotation_amount,
        'quotation_status_id': quotation_status_id,
    }), status_response