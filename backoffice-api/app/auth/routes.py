import os
from datetime import datetime, timedelta

from flask import request, jsonify
from sqlalchemy import exc

from . import auth
from ..models import AdminUser, ServiceType, ROLE_SUPERADMIN, ROLE_CARRIER, ROLE_REAL_ESTATE, _generate_referral_code
from ..utils import create_blank_company_and_vehicle
from ..carrier_documents import documents_url, make_token as documents_token
from ..email import send_email
from ..password_reset import make_token as password_reset_token, read_token as read_password_reset_token, reset_url
from .. import db


@auth.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'email and password are required'}), 400

    user = AdminUser.query.filter_by(email=data['email'].lower(), active=1).first()
    if user is None or not user.verify_password(data['password']):
        return jsonify({'message': 'invalid credentials'}), 401

    return jsonify({
        'token': user.generate_auth_token(),
        'user': user.to_dict(),
    }), 200


MIN_PASSWORD_LENGTH = 8
RESET_EMAIL_WAIT = timedelta(minutes=2)


@auth.route('/password-reset', methods=['POST'])
def request_password_reset():
    """Manda el link para crear una contraseña nueva.

    La respuesta es la misma haya o no una cuenta con ese correo: si no, el
    formulario serviría para averiguar quién tiene cuenta.
    """
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    answer = jsonify({'message': 'if the account exists, we sent an email'}), 202
    if not email:
        return jsonify({'message': 'email is required'}), 400

    user = AdminUser.query.filter_by(email=email, active=1).first()
    now = datetime.utcnow()
    if user is None or (user.password_reset_requested_at
                        and now - user.password_reset_requested_at < RESET_EMAIL_WAIT):
        return answer
    user.password_reset_requested_at = now
    db.session.commit()
    send_email(
        user.email,
        'Crea una contraseña nueva para Chalán',
        'email/password_reset',
        user=user,
        reset_url=reset_url(password_reset_token(user)),
    )
    return answer


@auth.route('/password-reset/confirm', methods=['POST'])
def confirm_password_reset():
    """Guarda la contraseña nueva y abre la sesión, como el login."""
    data = request.get_json() or {}
    password = data.get('password') or ''
    if len(password) < MIN_PASSWORD_LENGTH:
        return jsonify({'message': f'password must have at least {MIN_PASSWORD_LENGTH} characters'}), 400
    user, problem = read_password_reset_token(data.get('token') or '')
    if user is None:
        return jsonify({'message': 'invalid link', 'reason': problem}), 401
    user.password = password
    db.session.commit()
    return jsonify({
        'token': user.generate_auth_token(),
        'user': user.to_dict(),
    }), 200


@auth.route('/register', methods=['POST'])
def register():
    """Public registration — creates a carrier_company or real_estate_agent user pending admin activation."""
    data = request.get_json()
    required = ('email', 'password', 'first_name', 'last_name', 'dni')
    if not data or not all(data.get(k) for k in required):
        return jsonify({'message': 'email, password, first_name, last_name and dni are required'}), 400

    role = data.get('role', ROLE_CARRIER)
    if role not in (ROLE_CARRIER, ROLE_REAL_ESTATE):
        return jsonify({'message': 'role must be carrier_company or real_estate_agent'}), 400

    if role == ROLE_CARRIER and not data.get('phone'):
        return jsonify({'message': 'phone is required for carrier_company registration'}), 400

    # Desde la landing de un oficio (/profesionales/pintores...): la empresa
    # hace solo ese servicio. Solo los que se piden con formulario.
    service_type = None
    if role == ROLE_CARRIER and data.get('service_code'):
        service_type = ServiceType.query.filter_by(
            code=data['service_code'], requestable=1, active=1).first()
        if service_type is None:
            return jsonify({'message': 'unknown service'}), 400

    try:
        user = AdminUser(
            email=data['email'].strip().lower(),
            first_name=data['first_name'].strip(),
            last_name=data['last_name'].strip(),
            dni=data['dni'].strip(),
            role=role,
            active=0,  # pending admin approval
        )
        user.password = data['password']

        # Auto-create blank company + vehicle for carrier_company users
        if role == ROLE_CARRIER:
            db.session.add(user)
            company = create_blank_company_and_vehicle(
                email=data['email'].strip().lower(),
                phone=data['phone'].strip(),
                person_name=f"{user.first_name} {user.last_name}",
                service_type=service_type,
            )
            user.carrier_company_id = company.id

        # Generate unique referral code for real_estate_agent users
        if role == ROLE_REAL_ESTATE:
            user.referral_code = _generate_referral_code()

        db.session.add(user)
        db.session.commit()
    except exc.IntegrityError:
        db.session.rollback()
        return jsonify({'message': 'email already in use'}), 409

    if role == ROLE_CARRIER:
        service_name = service_type.name if service_type else None
        send_email(
            os.getenv('ADMIN_MAIL'),
            f'Nuevo profesional registrado: {service_name}' if service_name else 'Nuevo transportista registrado',
            'email/carrier_registered',
            user=user,
            phone=data['phone'].strip(),
            service_name=service_name,
        )
        # La landing sigue con el paso de documentos usando este token. El
        # correo lleva el mismo link para quien no los tenga a mano ahora.
        send_email(
            user.email,
            'Sube tus documentos para activar tu cuenta',
            'email/carrier_documents_request',
            user=user,
            documents_url=documents_url(user.carrier_company_id),
            service_name=service_name,
        )
        return jsonify({
            'message': 'registration successful, wait for admin approval',
            'documents_token': documents_token(user.carrier_company_id),
        }), 201

    return jsonify({'message': 'registration successful, wait for admin approval'}), 201


@auth.route('/seed', methods=['POST'])
def seed_superadmin():
    """Create the first superadmin. Disabled once any superadmin exists."""
    if AdminUser.query.filter_by(role=ROLE_SUPERADMIN).count() > 0:
        return jsonify({'message': 'superadmin already exists'}), 409

    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'email and password are required'}), 400

    try:
        user = AdminUser(
            email=data['email'].lower(),
            role=ROLE_SUPERADMIN,
        )
        user.password = data['password']
        db.session.add(user)
        db.session.commit()
    except exc.IntegrityError:
        db.session.rollback()
        return jsonify({'message': 'email already in use'}), 409

    return jsonify({'message': 'superadmin created', 'user': user.to_dict()}), 201


def _current_user():
    """Helper: returns AdminUser from Bearer token or None."""
    auth_header = request.headers.get('Authorization', '')
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        return None
    return AdminUser.verify_auth_token(parts[1])


@auth.route('/me', methods=['GET'])
def me():
    user = _current_user()
    if user is None:
        return jsonify({'message': 'missing or invalid token'}), 401
    return jsonify({'user': user.to_dict()}), 200


@auth.route('/me', methods=['PUT'])
def update_me():
    """Allow any authenticated user to update their own profile."""
    user = _current_user()
    if user is None:
        return jsonify({'message': 'missing or invalid token'}), 401

    data = request.get_json() or {}
    if 'first_name' in data:
        user.first_name = data['first_name'].strip()
    if 'last_name' in data:
        user.last_name = data['last_name'].strip()
    if 'dni' in data:
        user.dni = data['dni'].strip()
    if data.get('password'):
        user.password = data['password']

    db.session.commit()
    return jsonify({'user': user.to_dict()}), 200
