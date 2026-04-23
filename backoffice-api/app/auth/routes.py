from flask import request, jsonify
from sqlalchemy import exc

from . import auth
from ..models import AdminUser, ROLE_SUPERADMIN, ROLE_CARRIER, ROLE_REAL_ESTATE, _generate_referral_code
from ..utils import create_blank_company_and_vehicle
from .. import db


@auth.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'email and password are required'}), 400

    user = AdminUser.query.filter_by(email=data['email'].lower(), active=1).first()
    if user is None or not user.verify_password(data['password']):
        return jsonify({'message': 'invalid credentials'}), 401

    return jsonify({
        'token': user.generate_auth_token(),
        'user': user.to_dict(),
    }), 200


@auth.route('/register', methods=['POST'])
def register():
    """Public registration — creates a carrier_company or real_estate_agent user pending admin activation."""
    data = request.get_json()
    required = ('email', 'password', 'first_name', 'last_name', 'dni')
    if not data or not all(data.get(k) for k in required):
        return jsonify({'message': 'email, password, first_name, last_name and dni are required'}), 400

    role = data.get('role', ROLE_CARRIER)
    if role not in (ROLE_CARRIER, ROLE_REAL_ESTATE):
        return jsonify({'message': 'role must be carrier_company or real_estate_agent'}), 400

    try:
        user = AdminUser(
            email=data['email'].strip().lower(),
            first_name=data['first_name'].strip(),
            last_name=data['last_name'].strip(),
            dni=data['dni'].strip(),
            role=role,
            active=0,  # pending admin approval
        )
        user.password = data['password']

        # Auto-create blank company + vehicle for carrier_company users
        if role == ROLE_CARRIER:
            db.session.add(user)
            company = create_blank_company_and_vehicle(email=data['email'].strip().lower())
            user.carrier_company_id = company.id

        # Generate unique referral code for real_estate_agent users
        if role == ROLE_REAL_ESTATE:
            user.referral_code = _generate_referral_code()

        db.session.add(user)
        db.session.commit()
    except exc.IntegrityError:
        db.session.rollback()
        return jsonify({'message': 'email already in use'}), 409

    return jsonify({'message': 'registration successful, wait for admin approval'}), 201


@auth.route('/seed', methods=['POST'])
def seed_superadmin():
    """Create the first superadmin. Disabled once any superadmin exists."""
    if AdminUser.query.filter_by(role=ROLE_SUPERADMIN).count() > 0:
        return jsonify({'message': 'superadmin already exists'}), 409

    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'email and password are required'}), 400

    try:
        user = AdminUser(
            email=data['email'].lower(),
            role=ROLE_SUPERADMIN,
        )
        user.password = data['password']
        db.session.add(user)
        db.session.commit()
    except exc.IntegrityError:
        db.session.rollback()
        return jsonify({'message': 'email already in use'}), 409

    return jsonify({'message': 'superadmin created', 'user': user.to_dict()}), 201


def _current_user():
    """Helper: returns AdminUser from Bearer token or None."""
    auth_header = request.headers.get('Authorization', '')
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        return None
    return AdminUser.verify_auth_token(parts[1])


@auth.route('/me', methods=['GET'])
def me():
    user = _current_user()
    if user is None:
        return jsonify({'message': 'missing or invalid token'}), 401
    return jsonify({'user': user.to_dict()}), 200


@auth.route('/me', methods=['PUT'])
def update_me():
    """Allow any authenticated user to update their own profile."""
    user = _current_user()
    if user is None:
        return jsonify({'message': 'missing or invalid token'}), 401

    data = request.get_json() or {}
    if 'first_name' in data:
        user.first_name = data['first_name'].strip()
    if 'last_name' in data:
        user.last_name = data['last_name'].strip()
    if 'dni' in data:
        user.dni = data['dni'].strip()
    if data.get('password'):
        user.password = data['password']

    db.session.commit()
    return jsonify({'user': user.to_dict()}), 200
