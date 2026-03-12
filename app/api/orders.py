import os
import base64
import uuid
import stripe
from flask import jsonify, request, current_app
from openai import OpenAI
from ..models import Customer, Order, OrderImage, OrderImageSchema
from ..models import Quotations as QuotationsModel
from ..models import CarrierCompanySchema, QuotationsSchema
from . import api
from .decorators import token_required, carrier_company_token_required
from .order import Order as OrderEntity
from .order.steps.addresses import Addresses as AddressesStep
from .order.steps.belongings_appointment_date import BelongingsAppointmentDate as BelongingsAppointmentDateStep
from .quotation import Quotation as QuotationEntity
from .quotation.quotation_status import QuotationStatus
from .carrier_company import CarrierCompany as CarrierCompanyEntity
from .email import send_email
from datetime import date
from .errors import not_found
from .. import db
from ..storage import get_storage

@api.route('/order', methods=['POST'])
def create_order():
    order_data = request.json
    order = OrderEntity()
    order = order.create(request=order_data)
    return jsonify({
        'message': 'order {id} created!'.format(id=order.id),
        'order_id': order.id,
    }), 201

@api.route('/order/<int:order_id>', methods=['PUT'])
def update_order(order_id):
    order_data = request.json
    order = OrderEntity(order_id)
    order = order.update(request=order_data)
    emails_sent = send_email_to_carrier_companies(order_data)
    return jsonify({
        'message': 'order {id} updated!'.format(id=order.id),
        'order_id': order.id,
        'emails_sent_by_company_id': emails_sent
    }), 200

@api.route('/orders/details', methods=['GET'])
@carrier_company_token_required
def order_detail():
    auth_headers = request.headers.get('Authorization', '').split()
    data = CarrierCompanyEntity.verify_carrier_company_token(auth_headers[1])
    order = OrderEntity(data['order_id'])
    order_details = order.details()
    quotations = QuotationEntity().listByOrderId(data['order_id'])
    order_details['quotations'] = QuotationsSchema(many=True).dump(quotations.quotations)
    return jsonify({
        'order': order_details,
        'carrier_company_id': data['carrier_company_id'],
    }), 200

@api.route('/order/<int:order_id>', methods=['GET'])
@token_required
def get_order(order_id):
    auth_headers = request.headers.get('Authorization', '').split()
    customer = Customer.verify_auth_token(auth_headers[1])
    order = customer.orders.filter_by(id = order_id).first()
    if order is not None:
        order_detail = OrderEntity(order_id).details()
    else:
        return not_found('order not found')
    return jsonify({
        'order': order_detail,
    }), 200

@api.route('/order/checkout/<int:order_id>', methods=['PUT'])
@token_required
def generate_checkout_session(order_id):
    auth_headers = request.headers.get('Authorization', '').split()
    customer = Customer.verify_auth_token(auth_headers[1])
    order = customer.orders.order_by(Order.id.desc()).first()
    quotation = order.quotations.filter(QuotationsModel.selected == 1).first()
    if quotation.amount % 1 == 0:
        amount = int(quotation.amount)
    else:
        amount = quotation.amount

    stripe.api_key = current_app.config['STRIPE_SECRET_KEY']
    session = stripe.checkout.Session.create(
        customer_email = customer.email,
        client_reference_id = order_id,
        locale = 'es',
        success_url = current_app.config['STRIPE_SUCCESS'],
        cancel_url = current_app.config['STRIPE_CANCEL'],
        payment_method_types = ["card"],
        line_items = [
            {
                'name': '{} {} {}kg.'.format(quotation.vehicle.brand, quotation.vehicle.model, quotation.vehicle.weight),
                'description': quotation.vehicle.description,
                'amount': amount,
                'currency': 'mxn',
                'quantity': 1,
            }
        ],
    )
    order = OrderEntity(order.id)
    payment = order.create_stripe_payment(session.id)

    return jsonify({
        'session_id': session.id,
        'payment': payment.id,
    }), 200

@api.route('/order/checkout-cash/<int:order_id>', methods=['PUT'])
@token_required
def generate_checkout_cash(order_id):
    site_url = os.getenv('SITE_URL')
    auth_headers = request.headers.get('Authorization', '').split()
    customer = Customer.verify_auth_token(auth_headers[1])
    order_entity = OrderEntity(order_id)
    order_model = order_entity.query_orders({'id': order_id})
    quotation = order_model[0].quotations.filter_by(quotation_status_id = 2).first()
    carrier_company = quotation.carrier_company
    payment = order_entity.create_cash_payment()
    carrier_company_orders_url = CarrierCompanyEntity(carrier_company.id).generate_orders_url(order_id, site_url)

    subject = '[Pago en efectivo] Orden {} '.format(order_id)
    bcc = [os.getenv('OPS_MAIL')]

    if os.getenv('FLASK_ENV') != 'prod':
        subject = '[test][Pago en efectivo] Orden {} '.format(order_id)
        bcc = [os.getenv('ADMIN_MAIL')]

    send_email(
        carrier_company.email,
        subject,
        'email/admin_new_order',
        bcc=bcc,
        carrier_company_orders_url=carrier_company_orders_url,
    )
    send_email(
        customer.email,
        'Hemos agendado tu mudanza!',
        'email/cash_payment_selected',
        bcc=[],
        customer_name=customer.name,
        mobile_phone=customer.mobile_phone,
    )

    return jsonify({
        'payment': payment.id,
    }), 200

@api.route('order/confirm-stripe-payment/<int:order_id>', methods=['PUT'])
@token_required
def confirm_stripe_payment(order_id):
    data = request.json
    auth_headers = request.headers.get('Authorization', '').split()
    customer = Customer.verify_auth_token(auth_headers[1])
    last_order = customer.orders.order_by(Order.id.desc()).first()
    order = OrderEntity(order_id)
    driver_email = last_order.product.vehicle.carrier_company.email

    try:
        payment = order.confirm_stripe_payment(data['session_id'])
        if payment.status == 'paid':

            subject = '[Pago con tarjeta] Orden {}'.format(order_id),
            bcc = [os.getenv('OPS_MAIL'), driver_email]
            if os.getenv('FLASK_ENV') != 'prod':
                subject = '[test][Pago con tarjeta] Orden {} '.format(order_id)
                bcc = [os.getenv('ADMIN_MAIL')]
            current_year = date.today().year
            send_email(
                os.getenv('ADMIN_MAIL'),
                subject,
                'email/admin_new_order',
                bcc=bcc,
                order=last_order,
                mobile_phone=customer.mobile_phone,
                customer=customer,
                payment_type='card',
            )
            send_email(
                customer.email, 'Tu pago ha sido procesado correctamente',
                'email/stripe_payment_completed',
                bcc=[],
                customer_name=customer.name,
                mobile_phone=customer.mobile_phone,
            )
            return jsonify({
                'payment': payment.status,
            }), 200
    except:
        return jsonify({
            'message': 'There was a problem processing the payment.'
        }), 400


def send_email_to_carrier_companies(order_data):
    emails_sent = []
    try:
        order_data['requestQuotationFromCarrierCompany']
    except KeyError:
        return emails_sent

    order = order_data["order"]
    address_step = AddressesStep(order['order_id'])
    has_address_step_changed = address_step.has_changed(order_data)

    belongings_appointment_date_step = BelongingsAppointmentDateStep(order['order_id'])
    is_belongings_appointment_date_step_complete = belongings_appointment_date_step.is_complete()
    has_belongings_appointment_date_step_changed = belongings_appointment_date_step.has_changed(order_data)
    carrier_companies = get_carrier_companies(order)
    if is_belongings_appointment_date_step_complete:
        for carrier_company in carrier_companies:
            quotation_url = QuotationEntity().generate_quotation_url(
                order['order_id'],
                carrier_company['id'],
                os.getenv('SITE_URL')
            )
            quotation = QuotationEntity().get(order['order_id'], carrier_company['id'])
            if quotation is None or \
                has_address_step_changed or \
                has_belongings_appointment_date_step_changed:
                subject = 'Nueva cotización Chalán'
                if os.getenv('FLASK_ENV') != 'prod':
                    subject = '[test]Nueva cotización Chalán'
                send_email(
                    carrier_company['email'],
                    subject,
                    'email/ask_for_quotation',
                    bcc=[],
                    quotation_url=quotation_url,
                )
                emails_sent.append(carrier_company['id'])
            if quotation is not None and \
                (has_address_step_changed or \
                has_belongings_appointment_date_step_changed):
                QuotationEntity(quotation.id).update({
                    'quotation_status_id': QuotationStatus.Cancelled(),
                })
    return emails_sent

def get_carrier_companies(order):
    carrier_company_id = order['carrier_company_id']
    if carrier_company_id is not None:
        carrier_company = CarrierCompanyEntity(carrier_company_id)
        return [{
            'id': carrier_company.get_id(),
            'email': carrier_company.get_email()
        }]
    carrier_companies = CarrierCompanyEntity.get({
        'country_id': int(os.getenv('COUNTRY_ID')),
        'active': 1
    })
    return CarrierCompanySchema(many=True).dump(carrier_companies)


@api.route('/order/recognize-items', methods=['POST'])
def recognize_items():
    if 'image' not in request.files:
        return jsonify({'message': 'No image provided'}), 400

    order_id = request.form.get('order_id')
    if not order_id:
        return jsonify({'message': 'order_id is required'}), 400

    order = db.session.get(Order, order_id)
    if not order:
        return jsonify({'message': 'Order not found'}), 404

    image_file = request.files['image']

    allowed_types = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}
    if image_file.content_type not in allowed_types:
        return jsonify({'message': 'Invalid image type'}), 400

    max_size = 10 * 1024 * 1024
    image_data = image_file.read()
    if len(image_data) > max_size:
        return jsonify({'message': 'Image too large (max 10MB)'}), 400

    ext = image_file.content_type.split('/')[-1]
    storage_key = f'orders/{order_id}/{uuid.uuid4().hex}.{ext}'

    try:
        storage = get_storage()
        url = storage.upload(image_data, storage_key, image_file.content_type)

        order_image = OrderImage(order_id=order_id, url=url, storage_key=storage_key)
        db.session.add(order_image)
        db.session.commit()
    except Exception as e:
        current_app.logger.error(f'Image upload error: {str(e)}')
        return jsonify({'message': 'Error uploading image'}), 500

    base64_image = base64.b64encode(image_data).decode('utf-8')
    mime_type = image_file.content_type

    try:
        client = OpenAI(api_key=current_app.config['OPENAI_API_KEY'])
        response = client.chat.completions.create(
            model='gpt-4o-mini',
            messages=[
                {
                    'role': 'user',
                    'content': [
                        {
                            'type': 'text',
                            'text': (
                                'Analiza esta imagen e identifica todos los muebles y objetos visibles '
                                'que se necesitarían mover en una mudanza. '
                                'Responde SOLO con una lista, un objeto por línea, con la cantidad al inicio. '
                                'Formato: "1 sofá grande", "2 sillas", etc. '
                                'No incluyas explicaciones ni texto adicional.'
                            ),
                        },
                        {
                            'type': 'image_url',
                            'image_url': {
                                'url': f'data:{mime_type};base64,{base64_image}',
                                'detail': 'low',
                            },
                        },
                    ],
                }
            ],
            max_tokens=500,
        )
        items_text = response.choices[0].message.content.strip()
        items = [line.strip() for line in items_text.split('\n') if line.strip()]
        return jsonify({
            'items': items,
            'image': OrderImageSchema().dump(order_image),
        }), 200
    except Exception as e:
        current_app.logger.error(f'OpenAI Vision error: {str(e)}')
        return jsonify({
            'items': [],
            'image': OrderImageSchema().dump(order_image),
            'message': 'Image saved but could not identify items',
        }), 200