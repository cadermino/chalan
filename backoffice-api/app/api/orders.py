import os
from datetime import datetime, timedelta, timezone

import jwt
from flask import jsonify, g, current_app

from . import api
from .decorators import login_required
from ..models import Order, OrderDetail, Quotation, ROLE_CARRIER, ROLE_SUPERADMIN, ROLE_ADMIN


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

    # All orders in status 2 (sent to carrier companies)
    all_sent_orders = Order.query.filter_by(order_status_id=2).order_by(Order.created_date.desc()).all()

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
