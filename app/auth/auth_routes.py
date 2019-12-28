from flask import jsonify, request
import datetime
from . import auth
from ..models import Customer
from .. import db
from sqlalchemy import exc

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
    except exc.IntegrityError:
        db.session.rollback()
        return jsonify({'message' : 'duplicated email'}), 400

    return jsonify({'message' : 'usuario registrado'}), 201


@auth.route('/login', methods=['POST'])
def login():
    data = request.json
    customer = Customer.query.filter_by(email=data['email'].lower()).first()
    if customer is not None and customer.verify_password(data['password']):
        return jsonify({'token': customer.generate_auth_token(expiration=3600), 'expiration': 3600})
    return jsonify({'message': 'user doesn\'t exist'})