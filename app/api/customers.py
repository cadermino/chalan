from flask import jsonify, request
from . import api
from .quotation.quotation_status import QuotationStatus
from .decorators import token_required
from ..models import Customer, Order, Payment, Quotations
from .. import db

@api.route('/customer/<int:customer_id>', methods=['PATCH'])
@token_required
def update_customer(customer_id):
    auth_headers = request.headers.get('Authorization', '').split()
    customer = Customer.verify_auth_token(auth_headers[1])
    customer_data = request.json
    try:
        customer_data['id']
        return {}, 401
    except:
        for column in customer_data:
            if getattr(customer, column) != customer_data[column]:
                setattr(customer, column, customer_data[column])
                db.session.add(customer)
                db.session.commit()

        return {}, 204

@api.route('/customer/<int:customer_id>/orders', methods=['GET'])
@token_required
def customer_orders(customer_id):
    order = Order.query.\
        filter_by(customer_id = customer_id).order_by(Order.id.desc()).first()
    quotation = order.quotations.filter(Quotations.quotation_status_id == QuotationStatus.Selected()).first()
    if order is None:
        return jsonify([]), 200
    try:
        amount = quotation.amount
    except:
        amount = '-'
    try:
        payment_status = order.payments.order_by(Payment.id.desc()).first().status
    except:
        payment_status = 'pending'
    try:
        appointment_date = order.appointment_date.isoformat()
    except:
        appointment_date = '-'
    orders_datils = {
        'appointment_date': appointment_date,
        'carrier_company_name': quotation.carrier_company.name,
        'amount': amount,
        'payment_status': payment_status
    }
    order

    return jsonify([orders_datils]), 200