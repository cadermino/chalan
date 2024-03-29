import os
from flask import current_app, jsonify, request
from datetime import date
from . import auth
from ..models import Customer
from .. import db
from sqlalchemy import exc
from facepy import SignedRequest
from ..api.email import send_email
from ..api.carrier_company import CarrierCompany as CarrierCompanyEntity

@auth.route('/register', methods=['POST'])
def register():
    data = request.json
    if not data['name'] or not data['mobile_phone'] or not data['email'] or not data['password']:
        return jsonify({'message' : 'provide required data'}), 400
    try:
        customer = Customer(email=data['email'].lower(),
                    name=data['name'],
                    password=data['password'],
                    mobile_phone=data['mobile_phone'])

        db.session.add(customer)
        db.session.commit()
        subject = 'Nuevo usuario registrado'
        current_year = date.today().year
        send_email(
            os.getenv('ADMIN_MAIL'),
            subject,
            'email/user_registered',
            bcc='',
            customer=customer,
        )
    except exc.IntegrityError:
        db.session.rollback()
        return jsonify({'message' : 'duplicated email'}), 400

    return jsonify({
        'message' : 'usuario registrado',
        'token' : customer.generate_auth_token(expiration=86400),
        'name': customer.name,
        'email': customer.email,
        'mobile_phone': customer.mobile_phone
    }), 201


@auth.route('/login', methods=['POST'])
def login():
    data = request.json
    customer = Customer.query.filter_by(email=data['email'].lower()).first()
    if customer is not None and customer.verify_password(data['password']):
        return jsonify({
            'token': customer.generate_auth_token(expiration=86400),
            'expiration': 86400,
            'name': customer.name,
            'email': customer.email,
            'mobile_phone': customer.mobile_phone
        })
    return jsonify({
        'message': 'user doesn\'t exist'
    }), 400


@auth.route('/login-facebook', methods=['POST'])
def login_facebook():
    data = request.json
    try:
        SignedRequest.parse(data['token'], current_app.config['SECRET_FB_APP_KEY'])
    except:
        return jsonify({'message' : 'invalid token'}), 403
    try:
        customer = Customer.query.filter_by(email=data['email'].lower()).first()
        if customer and customer.mobile_phone != data['mobile_phone']:
            customer.mobile_phone = data['mobile_phone']
        if customer is None:
            customer = Customer(
                email=data['email'].lower(),
                name=data['name'],
                mobile_phone=data['mobile_phone'])
        db.session.add(customer)
        db.session.commit()
    except:
        return jsonify({'message' : 'provide required data'}), 400

    return jsonify({
        'message' : 'facebook user logged',
        'token' : customer.generate_auth_token(expiration=86400),
        'name': customer.name,
        'email': customer.email,
        'mobile_phone': customer.mobile_phone
    }), 201

@auth.route('/generate-carrier-company-token', methods=['POST'])
def quotation_token():
    data = request.json
    return jsonify({
        'token': CarrierCompanyEntity().generate_carrier_company_token(864000, data['order_id'], data['carrier_company_id']),
        'expiration': 864000,
    })