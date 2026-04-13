from flask import request, jsonify
from sqlalchemy import exc

from . import auth
from ..models import AdminUser, ROLE_SUPERADMIN
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


@auth.route('/me', methods=['GET'])
def me():
    auth_header = request.headers.get('Authorization', '')
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        return jsonify({'message': 'missing token'}), 401

    user = AdminUser.verify_auth_token(parts[1])
    if user is None:
        return jsonify({'message': 'invalid or expired token'}), 401

    return jsonify({'user': user.to_dict()}), 200
