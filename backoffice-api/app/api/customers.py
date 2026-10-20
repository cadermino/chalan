import os

import jwt
import requests
from flask import jsonify, request, g

from . import api
from .decorators import login_required
from .orders import _internal_headers
from ..models import Customer, ROLE_SUPERADMIN, ROLE_ADMIN
from .. import db


@api.route('/customers', methods=['GET'])
@login_required
def list_customers():
    user = g.current_user
    if user.role not in (ROLE_SUPERADMIN, ROLE_ADMIN):
        return jsonify({'message': 'forbidden'}), 403

    search = request.args.get('q', '').strip()
    query = Customer.query

    if search:
        like = f'%{search}%'
        query = query.filter(
            db.or_(
                Customer.name.ilike(like),
                Customer.paternal_last_name.ilike(like),
                Customer.email.ilike(like),
                Customer.mobile_phone.ilike(like),
            )
        )

    customers = query.order_by(Customer.created_date.desc()).limit(200).all()
    return jsonify({'customers': [c.to_dict() for c in customers]}), 200


@api.route('/customers', methods=['POST'])
@login_required
def create_customer():
    """Creates a customer account for support cases: someone called or
    messaged instead of registering on the site themselves. Proxies to the
    main API's own /api/auth/register (password hashing and the duplicate
    -email check stay in one place there) rather than writing a Customer
    row directly - same reasoning as orders.create_order.

    The account has no password: the customer opens their order with the
    link from "Copiar link del cliente" in the order detail (or the one in
    the new-quotation WhatsApp), not with a login. The internal token is what
    lets the main API register it without one."""
    user = g.current_user
    if user.role != ROLE_SUPERADMIN:
        return jsonify({'message': 'forbidden'}), 403

    data = request.get_json() or {}
    for field in ('name', 'email', 'mobile_phone'):
        if not data.get(field):
            return jsonify({'message': f'{field} is required'}), 400

    internal_api = os.getenv('INTERNAL_API_URL', 'http://flask-api:8001')
    try:
        res = requests.post(
            f'{internal_api}/api/auth/register',
            json={
                'name': data['name'],
                'email': data['email'],
                'mobile_phone': data['mobile_phone'],
            },
            headers=_internal_headers(),
            timeout=10,
        )
    except requests.RequestException:
        return jsonify({'message': 'could not reach the registration service'}), 502

    if res.status_code != 201:
        try:
            if res.json().get('message') == 'duplicated email':
                return jsonify({'message': 'ya existe un cliente con ese email'}), 400
        except ValueError:
            pass
        return jsonify({'message': 'failed to create customer'}), 502

    body = res.json()
    customer_id = None
    try:
        customer_id = jwt.decode(body['token'], options={'verify_signature': False}).get('id')
    except (jwt.PyJWTError, KeyError):
        pass

    return jsonify({'customer_id': customer_id, 'name': body.get('name'), 'email': body.get('email')}), 201
