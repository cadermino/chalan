from datetime import date
from decimal import Decimal, InvalidOperation

from flask import request, jsonify, g

from . import api
from .decorators import login_required, admin_required, superadmin_required
from ..models import Vehicle, CarrierCompany, Quotation, ROLE_CARRIER, MOVING_SERVICE_CODE
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


# Carrocería, tal como la inscribió SUNARP. No dice cómo está el camión hoy:
# un furgón inscrito puede tener barandas. Para eso está CARGO_COVERS.
BODY_TYPES = ('furgon', 'baranda', 'plataforma', 'pick_up', 'otro')

# Cómo viaja la carga, visto en fotos del camión. Es lo que ve el cliente.
CARGO_COVERS = ('cerrada', 'toldo', 'abierta')

TEXT_LIMITS = {'category': 10, 'body_type': 20, 'color': 30,
               'serial_number': 30, 'registry_entry': 20, 'cargo_cover': 10}

# Topes generosos, pero que atajan a quien escribe kg en un campo de toneladas
# (1100 en vez de 1.100) o cm en uno de metros.
MAX_TONS = Decimal('60')
MAX_METERS = Decimal('25')


def _blank(value):
    return value is None or (isinstance(value, str) and not value.strip())


def _parse_card_fields(data):
    """Valida los datos de la tarjeta (y cargo_cover) que vengan en `data`.

    Devuelve (valores, error). Solo incluye las llaves presentes, para que un
    PUT parcial no borre lo demás; un valor vacío las deja en NULL.
    """
    values = {}

    for field, limit in TEXT_LIMITS.items():
        if field not in data:
            continue
        value = data[field]
        if _blank(value):
            values[field] = None
            continue
        value = str(value).strip()
        if len(value) > limit:
            return None, f'{field} is too long (max {limit})'
        values[field] = value
    if values.get('category'):
        values['category'] = values['category'].upper()
    if values.get('body_type') and values['body_type'] not in BODY_TYPES:
        return None, 'invalid body_type'
    if values.get('cargo_cover') and values['cargo_cover'] not in CARGO_COVERS:
        return None, 'invalid cargo_cover'

    int_ranges = {'manufacture_year': (1950, date.today().year + 1), 'passengers': (0, 20)}
    for field, (low, high) in int_ranges.items():
        if field not in data:
            continue
        value = data[field]
        if _blank(value):
            values[field] = None
            continue
        try:
            number = int(str(value).strip())
        except ValueError:
            return None, f'{field} must be a whole number'
        if not low <= number <= high:
            return None, f'{field} must be between {low} and {high}'
        values[field] = number

    for field in Vehicle.CARD_DECIMAL_FIELDS:
        if field not in data:
            continue
        value = data[field]
        if _blank(value):
            values[field] = None
            continue
        try:
            number = Decimal(str(value).strip())
        except InvalidOperation:
            return None, f'{field} must be a number'
        high = MAX_TONS if field.endswith('_tons') else MAX_METERS
        if not number.is_finite() or not 0 < number <= high:
            return None, f'{field} must be greater than 0 and at most {high}'
        values[field] = number

    return values, None


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
    company = db.session.get(CarrierCompany, company_id)
    if company is None:
        return jsonify({'message': 'carrier company not found'}), 404
    # Los vehículos son de mudanzas: una empresa que solo embala o arma muebles
    # no los usa. Editar o desactivar los que ya tenga sí se puede.
    if not company.offers(MOVING_SERVICE_CODE):
        return jsonify({'message': 'company does not do moves'}), 409

    data = request.get_json() or {}
    card, error = _parse_card_fields(data)
    if error:
        return jsonify({'message': error}), 400

    vehicle = Vehicle(
        **card,
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
    card, error = _parse_card_fields(data)
    if error:
        return jsonify({'message': error}), 400
    for field, value in card.items():
        setattr(vehicle, field, value)
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
@admin_required
def delete_vehicle(company_id, vehicle_id):
    """Borra el vehículo, solo si nada lo necesita; si no, hay que desactivarlo.

    Las cotizaciones no guardan qué vehículo va: el API principal muestra el
    primero de la empresa (vehicles[0], activo o no). Sin ninguno, las
    cotizaciones de la empresa desaparecen de la lista del cliente, aunque ya
    haya elegido una. Por eso no se borra el último vehículo de una empresa
    que tiene cotizaciones, ni uno al que una cotización apunte por vehicle_id.
    Los transportistas solo desactivan (PUT active).
    """
    vehicle = Vehicle.query.filter_by(id=vehicle_id, carrier_company_id=company_id).first()
    if vehicle is None:
        return jsonify({'message': 'vehicle not found'}), 404

    if Quotation.query.filter_by(vehicle_id=vehicle.id).first() is not None:
        return jsonify({'message': 'vehicle has quotations'}), 409
    others = Vehicle.query.filter(Vehicle.carrier_company_id == company_id,
                                  Vehicle.id != vehicle.id).count()
    if others == 0 and Quotation.query.filter_by(carrier_company_id=company_id).first() is not None:
        return jsonify({'message': 'last vehicle of a company with quotations'}), 409

    db.session.delete(vehicle)
    db.session.commit()
    return jsonify({'message': 'vehicle deleted'}), 200
