from flask import jsonify, request

from . import api
from .decorators import login_required
from ..models import Customer, ROLE_SUPERADMIN, ROLE_ADMIN
from .. import db


@api.route('/customers', methods=['GET'])
@login_required
def list_customers():
    from flask import g
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
