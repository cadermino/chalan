import os
from flask import jsonify, request
from . import api
from .quotation import Quotation as QuotationEntity
from .quotation.quotation_status import QuotationStatus
from .order import Order as OrderEntity
from .order.order_status import OrderStatus
from .decorators import token_required, carrier_company_token_required
from .carrier_company import CarrierCompany as CarrierCompanyEntity
from ..models import Customer, ReferredOrder, AdminUser
from .email import send_email
from .whatsapp import send_whatsapp
from .. import db


def _accept_quotation(quotation_id):
    """Selects a quotation and recalculates the order total + referral
    commission. Shared by the customer-facing pick_quotation route and the
    internal admin_accept_quotation route below, so the two never drift."""
    QuotationEntity(quotation_id).pickQuotation()

    from ..models import Quotations as QuotationsModel, Order as OrderModel
    quotation = db.session.get(QuotationsModel, quotation_id)
    order = db.session.get(OrderModel, quotation.order_id)
    platform_fee = float(os.getenv('PLATFORM_FEE'))
    commission_rate = 0
    referred = ReferredOrder.query.filter_by(order_id=quotation.order_id).first()
    if referred:
        agent = db.session.get(AdminUser, referred.admin_user_id)
        commission_rate = agent.commission_rate
        referred.commission = quotation.amount * commission_rate
    order.total_amount = round(quotation.amount * (1 + commission_rate + platform_fee), 2)
    db.session.commit()
    return quotation, order

@api.route('/quotations/<int:order_id>', methods=['GET'])
@token_required
def get_quotations(order_id):
    auth_headers = request.headers.get('Authorization', '').split()
    Customer.verify_auth_token(auth_headers[1])
    platform_fee = float(os.getenv('PLATFORM_FEE'))
    commission_rate = 0
    referred = ReferredOrder.query.filter_by(order_id=order_id).first()
    if referred:
        agent = db.session.get(AdminUser, referred.admin_user_id)
        commission_rate = agent.commission_rate
    quotations = QuotationEntity().listByOrderId(order_id).toJson(commission_rate, platform_fee)
    return quotations, 200

@api.route('/quotation/<int:quotation_id>', methods=['PUT'])
@token_required
def pick_quotation(quotation_id):
    auth_headers = request.headers.get('Authorization', '').split()
    Customer.verify_auth_token(auth_headers[1])
    _accept_quotation(quotation_id)

    return jsonify({
        'quotation_id': quotation_id
    }), 200


@api.route('/order/<int:order_id>/quotation/<int:quotation_id>/accept', methods=['PATCH'])
def admin_accept_quotation(order_id, quotation_id):
    """Accepts a quotation on a customer's behalf - for the backoffice, when
    an admin needs to do this because the customer arranged it directly with
    the carrier instead of picking it themselves in the site. There's no
    customer impersonation, so this is unauthenticated like the other
    backoffice-proxied endpoints (POST /order, PUT /order/<id>) - reachable
    only over the internal Docker network via INTERNAL_API_URL, not exposed
    to the public otherwise."""
    from ..models import Quotations as QuotationsModel, Order as OrderModel
    quotation = QuotationsModel.query.filter_by(id=quotation_id, order_id=order_id).first()
    if quotation is None:
        return jsonify({'message': 'quotation not found'}), 404
    if quotation.quotation_status_id == QuotationStatus.Cancelled():
        return jsonify({'message': 'cancelled quotations cannot be accepted'}), 409
    order = db.session.get(OrderModel, order_id)
    if order is None or order.order_status_id != OrderStatus.pending():
        return jsonify({'message': 'order is not awaiting a quotation'}), 409

    _, order = _accept_quotation(quotation_id)

    return jsonify({
        'quotation_id': quotation_id,
        'total_amount': order.total_amount,
    }), 200

@api.route('/quotations', methods=['POST'])
@carrier_company_token_required
def create_quotation():
    quotation_data = request.json
    auth_headers = request.headers.get('Authorization', '').split()
    token_data = CarrierCompanyEntity.verify_carrier_company_token(auth_headers[1])
    order_id = token_data['order_id']
    carrier_company_id = token_data['carrier_company_id']
    base_amount = float(quotation_data['amount'])
    data = {
        'amount': base_amount,
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

        step_three_url = f"{os.getenv('SITE_URL')}order/step-three"
        subject = 'Tienes un nueva cotización para tu mudanza Chalán'
        send_email(
            customer.email,
            subject,
            'email/new_quotation_arrived',
            bcc=[os.getenv('ADMIN_MAIL')],
            step_three_url=step_three_url,
            customer_name=customer.name
        )
        send_whatsapp(
            customer.mobile_phone,
            os.getenv('TWILIO_TEMPLATE_CLIENTE'),
            {'1': step_three_url},
            body_label='[Plantilla: Nueva cotización disponible]',
            customer_id=customer.id,
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