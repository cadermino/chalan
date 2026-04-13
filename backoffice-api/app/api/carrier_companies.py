from flask import request, jsonify, g

from . import api
from .decorators import login_required, admin_required
from ..models import CarrierCompany, ROLE_CARRIER
from .. import db


def _can_access_company(company_id):
    """Carrier company users can only access their own company."""
    user = g.current_user
    if user.role == ROLE_CARRIER:
        return user.carrier_company_id == company_id
    return True


@api.route('/carrier-companies', methods=['GET'])
@login_required
def list_carrier_companies():
    user = g.current_user
    if user.role == ROLE_CARRIER:
        companies = CarrierCompany.query.filter_by(id=user.carrier_company_id).all()
    else:
        companies = CarrierCompany.query.order_by(CarrierCompany.name).all()
    return jsonify({'carrier_companies': [c.to_dict() for c in companies]}), 200


@api.route('/carrier-companies/<int:company_id>', methods=['GET'])
@login_required
def get_carrier_company(company_id):
    if not _can_access_company(company_id):
        return jsonify({'message': 'forbidden'}), 403
    company = db.session.get(CarrierCompany, company_id)
    if company is None:
        return jsonify({'message': 'carrier company not found'}), 404
    return jsonify({'carrier_company': company.to_dict()}), 200


@api.route('/carrier-companies', methods=['POST'])
@admin_required
def create_carrier_company():
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'message': 'name is required'}), 400

    company = CarrierCompany(
        name=data['name'],
        description=data.get('description'),
        rfc=data.get('rfc'),
        email=data.get('email'),
        phone=data.get('phone'),
        address=data.get('address'),
        cover_image=data.get('cover_image'),
        facebook=data.get('facebook'),
        youtube=data.get('youtube'),
        country_id=data.get('country_id'),
        active=1,
    )
    db.session.add(company)
    db.session.commit()
    return jsonify({'carrier_company': company.to_dict()}), 201


@api.route('/carrier-companies/<int:company_id>', methods=['PUT'])
@login_required
def update_carrier_company(company_id):
    if not _can_access_company(company_id):
        return jsonify({'message': 'forbidden'}), 403
    company = db.session.get(CarrierCompany, company_id)
    if company is None:
        return jsonify({'message': 'carrier company not found'}), 404

    data = request.get_json() or {}
    for field in ('name', 'description', 'rfc', 'email', 'phone', 'address',
                  'cover_image', 'facebook', 'youtube', 'country_id'):
        if field in data:
            setattr(company, field, data[field])
    if 'active' in data:
        company.active = 1 if data['active'] else 0

    db.session.commit()
    return jsonify({'carrier_company': company.to_dict()}), 200


@api.route('/carrier-companies/<int:company_id>', methods=['DELETE'])
@admin_required
def delete_carrier_company(company_id):
    company = db.session.get(CarrierCompany, company_id)
    if company is None:
        return jsonify({'message': 'carrier company not found'}), 404
    company.active = 0
    db.session.commit()
    return jsonify({'message': 'carrier company deactivated'}), 200
