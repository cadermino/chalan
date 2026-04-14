from flask import request, jsonify, g
from sqlalchemy import exc

from . import api
from .decorators import login_required, superadmin_required
from ..models import AdminUser, CarrierCompany, Vehicle, ALL_ROLES, ROLE_CARRIER
from ..utils import create_blank_company_and_vehicle
from .. import db


@api.route('/users', methods=['GET'])
@superadmin_required
def list_users():
    users = AdminUser.query.order_by(AdminUser.created_date.desc()).all()
    return jsonify({'users': [u.to_dict() for u in users]}), 200


@api.route('/users', methods=['POST'])
@superadmin_required
def create_user():
    data = request.get_json()
    required = ('email', 'password', 'role')
    if not data or not all(data.get(k) for k in required):
        return jsonify({'message': 'email, password and role are required'}), 400
    if data['role'] not in ALL_ROLES:
        return jsonify({'message': f'role must be one of {ALL_ROLES}'}), 400

    # Validate carrier_company_id if explicitly provided
    carrier_company_id = data.get('carrier_company_id') or None
    if carrier_company_id:
        if not db.session.get(CarrierCompany, carrier_company_id):
            return jsonify({'message': 'carrier company not found'}), 404

    try:
        user = AdminUser(
            email=data['email'].lower(),
            first_name=data.get('first_name', '').strip() or None,
            last_name=data.get('last_name', '').strip() or None,
            dni=data.get('dni', '').strip() or None,
            role=data['role'],
            carrier_company_id=carrier_company_id,
        )
        user.password = data['password']
        db.session.add(user)

        # Auto-create blank company + vehicle for new carrier_company users
        if data['role'] == ROLE_CARRIER and not carrier_company_id:
            company = create_blank_company_and_vehicle(email=data['email'].lower())
            user.carrier_company_id = company.id

        db.session.commit()
    except exc.IntegrityError:
        db.session.rollback()
        return jsonify({'message': 'email already in use'}), 409

    return jsonify({'user': user.to_dict()}), 201


@api.route('/users/<int:user_id>', methods=['GET'])
@superadmin_required
def get_user(user_id):
    user = db.session.get(AdminUser, user_id)
    if user is None:
        return jsonify({'message': 'user not found'}), 404
    return jsonify({'user': user.to_dict()}), 200


@api.route('/users/<int:user_id>', methods=['PUT'])
@superadmin_required
def update_user(user_id):
    user = db.session.get(AdminUser, user_id)
    if user is None:
        return jsonify({'message': 'user not found'}), 404

    data = request.get_json() or {}
    if 'role' in data:
        if data['role'] not in ALL_ROLES:
            return jsonify({'message': f'role must be one of {ALL_ROLES}'}), 400
        user.role = data['role']
    if 'carrier_company_id' in data:
        if data['carrier_company_id'] and not db.session.get(CarrierCompany, data['carrier_company_id']):
            return jsonify({'message': 'carrier company not found'}), 404
        user.carrier_company_id = data['carrier_company_id']
    if 'password' in data and data['password']:
        user.password = data['password']
    if 'active' in data:
        user.active = 1 if data['active'] else 0

    db.session.commit()
    return jsonify({'user': user.to_dict()}), 200


@api.route('/users/<int:user_id>', methods=['DELETE'])
@superadmin_required
def delete_user(user_id):
    user = db.session.get(AdminUser, user_id)
    if user is None:
        return jsonify({'message': 'user not found'}), 404
    # Soft delete
    user.active = 0
    db.session.commit()
    return jsonify({'message': 'user deactivated'}), 200
