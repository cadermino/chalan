import os
from datetime import datetime, timedelta, timezone

import jwt
from flask import jsonify, g, current_app, request

from . import api
from .decorators import login_required
from ..models import Order, OrderDetail, Quotation, ReferredOrder, ROLE_CARRIER, ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_REAL_ESTATE
from .. import db


def _generate_quotation_token(carrier_company_id, order_id):
    payload = {
        'carrier_company_id': carrier_company_id,
        'order_id': order_id,
        'exp': datetime.now(timezone.utc) + timedelta(seconds=864000),
        'iat': datetime.now(timezone.utc),
    }
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')


@api.route('/orders/pending', methods=['GET'])
@login_required
def list_pending_orders():
    """
    For carrier_company users: returns orders that have been sent to them
    (exist in quotations table for their company, with status active=1)
    or all active orders without a quotation from them yet.

    Practically: returns orders where this carrier_company has a quotation
    with status_id=1 (pending/active) or no quotation at all (order_status_id=2 = sent).
    """
    user = g.current_user

    if user.role == ROLE_CARRIER:
        company_id = user.carrier_company_id
    elif user.role in (ROLE_SUPERADMIN, ROLE_ADMIN):
        company_id = None  # superadmin sees all, no company filter
    else:
        return jsonify({'message': 'forbidden'}), 403

    # Orders in status 1 (pending) or 2 (in_progress)
    all_sent_orders = Order.query.filter(Order.order_status_id.in_([1, 2])).order_by(Order.created_date.desc()).all()

    # Quotations already submitted (per company if carrier_company, all if admin)
    if company_id is not None:
        submitted_order_ids = {
            q.order_id
            for q in Quotation.query.filter_by(carrier_company_id=company_id).all()
        }
    else:
        submitted_order_ids = set()  # superadmin: show all regardless

    site_url = os.environ.get('SITE_URL', 'https://chalan.pe/')

    result = []
    for order in all_sent_orders:
        has_quotation = order.id in submitted_order_ids
        details = list(order.order_details)
        origin = next((d for d in details if d.type == 'carry_from'), None)
        destination = next((d for d in details if d.type == 'deliver_to'), None)

        # For superadmin, quotation_url is not applicable (no fixed company)
        quotation_url = None
        if company_id is not None:
            token = _generate_quotation_token(company_id, order.id)
            quotation_url = f"{site_url}quotation/{token}"

        result.append({
            **order.to_dict(),
            'has_quotation': has_quotation,
            'quotation_url': quotation_url,
            'origin': origin.to_dict() if origin else None,
            'destination': destination.to_dict() if destination else None,
        })

    return jsonify({'orders': result}), 200


@api.route('/orders/<int:order_id>', methods=['GET'])
@login_required
def get_order(order_id):
    """Order detail with addresses and current quotation for this carrier company."""
    user = g.current_user
    if user.role not in (ROLE_CARRIER, ROLE_SUPERADMIN, ROLE_ADMIN):
        return jsonify({'message': 'forbidden'}), 403

    company_id = user.carrier_company_id if user.role == ROLE_CARRIER else None
    order = Order.query.get(order_id)
    if order is None:
        return jsonify({'message': 'order not found'}), 404

    details = list(order.order_details)
    origin = next((d for d in details if d.type == 'carry_from'), None)
    destination = next((d for d in details if d.type == 'deliver_to'), None)

    existing_quotation = Quotation.query.filter_by(
        order_id=order_id, carrier_company_id=company_id
    ).first() if company_id is not None else None

    quotation_url = None
    if company_id is not None:
        site_url = os.environ.get('SITE_URL', 'https://chalan.pe/')
        token = _generate_quotation_token(company_id, order_id)
        quotation_url = f"{site_url}quotation/{token}"

    return jsonify({
        'order': {
            **order.to_dict(),
            'origin': origin.to_dict() if origin else None,
            'destination': destination.to_dict() if destination else None,
            'quotation_url': quotation_url,
            'existing_quotation': existing_quotation.to_dict() if existing_quotation else None,
        }
    }), 200


@api.route('/orders/<int:order_id>', methods=['PUT'])
@login_required
def update_order(order_id):
    user = g.current_user
    if user.role != ROLE_SUPERADMIN:
        return jsonify({'message': 'forbidden'}), 403

    order = Order.query.get(order_id)
    if order is None:
        return jsonify({'message': 'order not found'}), 404

    data = request.get_json() or {}

    if 'appointment_date' in data:
        from datetime import datetime as dt
        try:
            order.appointment_date = dt.fromisoformat(data['appointment_date']) if data['appointment_date'] else None
        except ValueError:
            return jsonify({'message': 'invalid appointment_date format'}), 400
    if 'order_status_id' in data:
        order.order_status_id = data['order_status_id']
    if 'approximate_budget' in data:
        order.approximate_budget = data['approximate_budget']
    if 'total_kilometers' in data:
        order.total_kilometers = data['total_kilometers']
    if 'comments' in data:
        order.comments = data['comments']

    for addr_type, key in [('carry_from', 'origin'), ('deliver_to', 'destination')]:
        addr_data = data.get(key)
        if addr_data is None:
            continue
        detail = OrderDetail.query.filter_by(order_id=order_id, type=addr_type).first()
        if detail is None:
            continue
        for field in ('street', 'neighborhood', 'city', 'state', 'floor_number'):
            if field in addr_data:
                setattr(detail, field, addr_data[field])

    db.session.commit()

    details = list(order.order_details)
    origin = next((d for d in details if d.type == 'carry_from'), None)
    destination = next((d for d in details if d.type == 'deliver_to'), None)

    return jsonify({
        'order': {
            **order.to_dict(),
            'origin': origin.to_dict() if origin else None,
            'destination': destination.to_dict() if destination else None,
        }
    }), 200


@api.route('/referred-orders', methods=['GET'])
@login_required
def list_referred_orders():
    """Orders referred by the current real_estate_agent user."""
    user = g.current_user
    if user.role == ROLE_REAL_ESTATE:
        refs = ReferredOrder.query.filter_by(admin_user_id=user.id)\
            .order_by(ReferredOrder.created_date.desc()).all()
    elif user.role in (ROLE_SUPERADMIN, ROLE_ADMIN):
        refs = ReferredOrder.query.order_by(ReferredOrder.created_date.desc()).all()
    else:
        return jsonify({'message': 'forbidden'}), 403

    # Status 3=completed, 4=cancelled
    EXCLUDED_STATUSES = (3, 4)

    result = []
    commission_balance = 0
    for ref in refs:
        order = db.session.get(Order, ref.order_id)
        if order is None:
            continue
        details = list(order.order_details)
        origin = next((d for d in details if d.type == 'carry_from'), None)
        destination = next((d for d in details if d.type == 'deliver_to'), None)
        result.append({
            **order.to_dict(),
            'referred_by': ref.admin_user_id,
            'referred_date': ref.created_date.isoformat() if ref.created_date else None,
            'commission': ref.commission,
            'origin': origin.to_dict() if origin else None,
            'destination': destination.to_dict() if destination else None,
        })
        if order.order_status_id not in EXCLUDED_STATUSES:
            commission_balance += ref.commission or 0

    return jsonify({'orders': result, 'commission_balance': commission_balance}), 200


@api.route('/referred-orders', methods=['POST'])
@login_required
def create_referred_order():
    """Assign an order to a real_estate_agent."""
    user = g.current_user
    if user.role not in (ROLE_SUPERADMIN, ROLE_ADMIN):
        return jsonify({'message': 'admin access required'}), 403

    data = request.get_json()
    if not data or not data.get('admin_user_id') or not data.get('order_id'):
        return jsonify({'message': 'admin_user_id and order_id are required'}), 400

    from ..models import AdminUser
    agent = db.session.get(AdminUser, data['admin_user_id'])
    if agent is None or agent.role != ROLE_REAL_ESTATE:
        return jsonify({'message': 'agent not found or not a real_estate_agent'}), 404

    order = db.session.get(Order, data['order_id'])
    if order is None:
        return jsonify({'message': 'order not found'}), 404

    existing = ReferredOrder.query.filter_by(
        admin_user_id=data['admin_user_id'], order_id=data['order_id']
    ).first()
    if existing:
        return jsonify({'message': 'order already referred to this agent'}), 409

    ref = ReferredOrder(admin_user_id=data['admin_user_id'], order_id=data['order_id'])
    db.session.add(ref)
    db.session.commit()

    return jsonify({'referred_order': ref.to_dict()}), 201
