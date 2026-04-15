from flask import request, jsonify, g

from . import api
from .decorators import login_required, admin_required, superadmin_required
from ..models import Vehicle, CarrierCompany, ROLE_CARRIER
from .. import db


@api.route('/vehicles', methods=['GET'])
@superadmin_required
def list_all_vehicles():
    vehicles = Vehicle.query.join(CarrierCompany, Vehicle.carrier_company_id == CarrierCompany.id).all()
    result = []
    for v in vehicles:
        d = v.to_dict()
        d['company_name'] = v.carrier_company.name if v.carrier_company else ''
        result.append(d)
    return jsonify({'vehicles': result}), 200


def _can_access_company(company_id):
    user = g.current_user
    if user.role == ROLE_CARRIER:
        return user.carrier_company_id == company_id
    return True


@api.route('/carrier-companies/<int:company_id>/vehicles', methods=['GET'])
@login_required
def list_vehicles(company_id):
    if not _can_access_company(company_id):
        return jsonify({'message': 'forbidden'}), 403
    vehicles = Vehicle.query.filter_by(carrier_company_id=company_id).all()
    return jsonify({'vehicles': [v.to_dict() for v in vehicles]}), 200


@api.route('/carrier-companies/<int:company_id>/vehicles', methods=['POST'])
@login_required
def create_vehicle(company_id):
    if not _can_access_company(company_id):
        return jsonify({'message': 'forbidden'}), 403
    if db.session.get(CarrierCompany, company_id) is None:
        return jsonify({'message': 'carrier company not found'}), 404

    data = request.get_json() or {}

    vehicle = Vehicle(
        carrier_company_id=company_id,
        brand=data.get('brand'),
        model=data.get('model'),
        plates=data.get('plates'),
        size=data.get('size', 'medium'),
        description=data.get('description'),
        picture=data.get('picture'),
        weight=data.get('weight'),
        width=data.get('width'),
        height=data.get('height'),
        length=data.get('length'),
        base_address=data.get('base_address'),
        charge_per_kilometer=data.get('charge_per_kilometer', 0),
        charge_per_floor=data.get('charge_per_floor', 0),
        driver_fee=data.get('driver_fee', 0),
        loader_fee=data.get('loader_fee', 0),
        loaders_quantity=data.get('loaders_quantity', 0),
        active=1 if data.get('active', True) else 0,
    )
    db.session.add(vehicle)
    db.session.commit()
    return jsonify({'vehicle': vehicle.to_dict()}), 201


@api.route('/carrier-companies/<int:company_id>/vehicles/<int:vehicle_id>', methods=['GET'])
@login_required
def get_vehicle(company_id, vehicle_id):
    if not _can_access_company(company_id):
        return jsonify({'message': 'forbidden'}), 403
    vehicle = Vehicle.query.filter_by(id=vehicle_id, carrier_company_id=company_id).first()
    if vehicle is None:
        return jsonify({'message': 'vehicle not found'}), 404
    return jsonify({'vehicle': vehicle.to_dict()}), 200


@api.route('/carrier-companies/<int:company_id>/vehicles/<int:vehicle_id>', methods=['PUT'])
@login_required
def update_vehicle(company_id, vehicle_id):
    if not _can_access_company(company_id):
        return jsonify({'message': 'forbidden'}), 403
    vehicle = Vehicle.query.filter_by(id=vehicle_id, carrier_company_id=company_id).first()
    if vehicle is None:
        return jsonify({'message': 'vehicle not found'}), 404

    data = request.get_json() or {}
    for field in ('brand', 'model', 'plates', 'size', 'description', 'picture',
                  'weight', 'width', 'height', 'length', 'base_address',
                  'charge_per_kilometer', 'charge_per_floor', 'driver_fee',
                  'loader_fee', 'loaders_quantity'):
        if field in data:
            setattr(vehicle, field, data[field])
    if 'active' in data:
        vehicle.active = 1 if data['active'] else 0

    db.session.commit()
    return jsonify({'vehicle': vehicle.to_dict()}), 200


@api.route('/carrier-companies/<int:company_id>/vehicles/<int:vehicle_id>', methods=['DELETE'])
@login_required
def delete_vehicle(company_id, vehicle_id):
    if not _can_access_company(company_id):
        return jsonify({'message': 'forbidden'}), 403
    vehicle = Vehicle.query.filter_by(id=vehicle_id, carrier_company_id=company_id).first()
    if vehicle is None:
        return jsonify({'message': 'vehicle not found'}), 404
    vehicle.active = 0
    db.session.commit()
    return jsonify({'message': 'vehicle deactivated'}), 200
