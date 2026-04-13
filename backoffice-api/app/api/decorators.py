from functools import wraps
from flask import request, jsonify, g
from ..models import AdminUser, ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_CARRIER


def _get_current_user():
    auth_header = request.headers.get('Authorization', '')
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        return None
    return AdminUser.verify_auth_token(parts[1])


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = _get_current_user()
        if user is None:
            return jsonify({'message': 'authentication required'}), 401
        g.current_user = user
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """Allows superadmin and admin."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = _get_current_user()
        if user is None:
            return jsonify({'message': 'authentication required'}), 401
        if user.role not in (ROLE_SUPERADMIN, ROLE_ADMIN):
            return jsonify({'message': 'admin access required'}), 403
        g.current_user = user
        return f(*args, **kwargs)
    return decorated


def superadmin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = _get_current_user()
        if user is None:
            return jsonify({'message': 'authentication required'}), 401
        if user.role != ROLE_SUPERADMIN:
            return jsonify({'message': 'superadmin access required'}), 403
        g.current_user = user
        return f(*args, **kwargs)
    return decorated
