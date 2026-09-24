from flask import request, jsonify, g

from . import api
from .decorators import login_required, admin_required
from ..models import AdminUser, CarrierCompany, ROLE_CARRIER, ROLE_SUPERADMIN, ROLE_ADMIN
from .. import db


def _can_access_company(company_id):
    """Carrier company users can only access their own company."""
    user = g.current_user
    if user.role == ROLE_CARRIER:
        return user.carrier_company_id == company_id
    return True


def _users_by_company(company_ids):
    """Usuarios ligados a cada empresa, en una sola consulta.

    Sin esto no hay forma de saber de quién es una empresa desde la lista. El
    registro público de la landing crea la empresa en blanco junto con el
    usuario; ahora nace con el nombre de quien la registró, pero eso es un
    provisional que el transportista cambia por el de su empresa apenas
    completa el perfil, y ahí se vuelve a perder el rastro.

    Una empresa puede no tener usuario (las que crea un admin a mano) o tener
    más de uno, por eso el valor es una lista y no un solo usuario.
    """
    if not company_ids:
        return {}
    users = AdminUser.query.filter(
        AdminUser.carrier_company_id.in_(company_ids)
    ).order_by(AdminUser.id).all()

    grouped = {}
    for user in users:
        grouped.setdefault(user.carrier_company_id, []).append({
            'id': user.id,
            'name': ' '.join(filter(None, [user.first_name, user.last_name])) or None,
            'email': user.email,
            'role': user.role,
            # Un transportista recién registrado queda inactivo esperando
            # aprobación: es justo el caso en que hay que saber quién es.
            'active': bool(user.active),
        })
    return grouped


@api.route('/carrier-companies', methods=['GET'])
@login_required
def list_carrier_companies():
    user = g.current_user
    if user.role == ROLE_CARRIER:
        companies = CarrierCompany.query.filter_by(id=user.carrier_company_id).all()
    else:
        companies = CarrierCompany.query.order_by(CarrierCompany.name).all()

    # Solo para admins: al transportista se le devuelve únicamente su propia
    # empresa, y no tiene por qué recibir la lista de cuentas ligadas a ella.
    users_by_company = {}
    if user.role in (ROLE_SUPERADMIN, ROLE_ADMIN):
        users_by_company = _users_by_company([c.id for c in companies])

    return jsonify({'carrier_companies': [
        {**c.to_dict(), 'users': users_by_company.get(c.id, [])} for c in companies
    ]}), 200


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
