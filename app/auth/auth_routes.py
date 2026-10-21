import os
import re
from flask import current_app, jsonify, request
from datetime import date
from . import auth
from ..models import Customer, Order
from .. import db
from ..api.decorators import is_internal_request
from ..api.order_access import order_access_url, read_token
from sqlalchemy import exc
from facepy import SignedRequest
from ..api.email import send_email
from ..api.carrier_company import CarrierCompany as CarrierCompanyEntity

@auth.route('/register', methods=['POST'])
def register():
    data = request.json or {}
    # El backoffice crea clientes sin contraseña: entran con el link de su
    # orden (api/order_access.py). Desde el sitio sigue siendo obligatoria.
    password_required = not is_internal_request()
    if (not isinstance(data, dict) or not data.get('name') or not data.get('mobile_phone')
            or not data.get('email') or (password_required and not data.get('password'))):
        return jsonify({'message' : 'provide required data'}), 400
    try:
        customer = Customer(email=data['email'].lower(),
                    name=data['name'],
                    mobile_phone=data['mobile_phone'])
        if data.get('password'):
            customer.password = data['password']

        db.session.add(customer)
        db.session.commit()
        subject = 'Nuevo usuario registrado'
        current_year = date.today().year
        send_email(
            os.getenv('ADMIN_MAIL'),
            subject,
            'email/user_registered',
            bcc='',
            customer=customer,
        )
    except exc.IntegrityError:
        db.session.rollback()
        return jsonify({'message' : 'duplicated email'}), 400
    except exc.DataError:
        db.session.rollback()
        return jsonify({'message' : 'one or more fields exceed the maximum allowed length'}), 400

    return jsonify({
        'message' : 'usuario registrado',
        'token' : customer.generate_auth_token(expiration=86400),
        'name': customer.name,
        'email': customer.email,
        'mobile_phone': customer.mobile_phone
    }), 201


@auth.route('/login', methods=['POST'])
def login():
    data = request.json or {}
    if not isinstance(data, dict):
        return jsonify({'message': 'provide required data'}), 400
    email = data.get('email')
    password = data.get('password')
    if not email or not password:
        return jsonify({'message': 'provide required data'}), 400
    customer = Customer.query.filter_by(email=email.lower()).first()
    if customer is not None and customer.verify_password(password):
        return jsonify({
            'token': customer.generate_auth_token(expiration=86400),
            'expiration': 86400,
            'name': customer.name,
            'email': customer.email,
            'mobile_phone': customer.mobile_phone
        })
    return jsonify({
        'message': 'user doesn\'t exist'
    }), 400


@auth.route('/order-access', methods=['POST'])
def order_access():
    """Canjea el link de una orden por una sesión, como si hubiera hecho login."""
    data = request.json or {}
    token = data.get('token') if isinstance(data, dict) else None
    if not token or not isinstance(token, str):
        return jsonify({'message': 'provide required data'}), 400
    ids, reason = read_token(token)
    if ids is None:
        return jsonify({'message': 'invalid link', 'reason': reason}), 401
    order_id, customer_id = ids
    order = db.session.get(Order, order_id)
    # Si la orden cambió de dueño después de mandar el link, el link ya no vale.
    if order is None or order.customer_id is None or order.customer_id != customer_id:
        return jsonify({'message': 'invalid link', 'reason': 'invalid'}), 401
    customer = db.session.get(Customer, customer_id)
    if customer is None:
        return jsonify({'message': 'invalid link', 'reason': 'invalid'}), 401
    return jsonify({
        'token': customer.generate_auth_token(expiration=86400),
        'expiration': 86400,
        'name': customer.name,
        'email': customer.email,
        'mobile_phone': customer.mobile_phone,
        'order_id': order.id,
    }), 200


EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


def _mask_email(email):
    user, _, domain = email.partition('@')
    return f'{user[:2]}***@{domain}'


@auth.route('/order-contact', methods=['POST'])
def order_contact():
    """Datos de contacto en vez de crear una cuenta, para ver las cotizaciones.

    Era el muro entre el paso 2 y el 3: registro con contraseña, y no hay forma
    de recuperarla. Ahora basta nombre, correo y WhatsApp. Con un correo nuevo
    se crea el cliente sin contraseña, se le liga la orden y sale con sesión.

    Con un correo que ya tiene cuenta no se da la sesión: quien escribe el
    correo de otro vería sus órdenes. Se liga la orden a esa cuenta y el link
    de acceso (api/order_access.py) va a ese correo; quien lo abre es el dueño.
    Hasta entonces la orden no llega a los transportistas, porque eso lo
    dispara el paso 3.
    """
    data = request.json or {}
    if not isinstance(data, dict):
        return jsonify({'message': 'provide required data'}), 400
    order_id = data.get('order_id')
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    mobile_phone = (data.get('mobile_phone') or '').strip()
    if not isinstance(order_id, int) or not name or not email or not mobile_phone:
        return jsonify({'message': 'provide required data'}), 400
    if not EMAIL_RE.match(email):
        return jsonify({'message': 'invalid email'}), 400

    order = db.session.get(Order, order_id)
    if order is None:
        return jsonify({'message': 'order not found'}), 404
    if order.customer_id is not None:
        # Ya es de alguien: que entre con su cuenta o con el link de su orden.
        return jsonify({'message': 'order already has a customer'}), 409

    customer = Customer.query.filter_by(email=email).first()
    if customer is not None:
        order.customer_id = customer.id
        if not order.lead_phone:
            order.lead_phone = mobile_phone
        db.session.commit()
        send_email(
            customer.email,
            'Confirma tu pedido de mudanza en Chalán',
            'email/order_access_link',
            bcc=[],
            customer_name=customer.name,
            access_url=order_access_url(order),
        )
        return jsonify({'message': 'link sent', 'email': _mask_email(customer.email)}), 202

    try:
        customer = Customer(email=email, name=name, mobile_phone=mobile_phone)
        db.session.add(customer)
        db.session.flush()
        order.customer_id = customer.id
        db.session.commit()
    except exc.IntegrityError:
        # Otro pedido creó el mismo correo entre la búsqueda y el insert.
        db.session.rollback()
        return jsonify({'message': 'duplicated email'}), 409
    except exc.DataError:
        db.session.rollback()
        return jsonify({'message': 'one or more fields exceed the maximum allowed length'}), 400

    send_email(
        os.getenv('ADMIN_MAIL'),
        'Nuevo usuario registrado',
        'email/user_registered',
        bcc='',
        customer=customer,
    )
    return jsonify({
        'token': customer.generate_auth_token(expiration=86400),
        'expiration': 86400,
        'name': customer.name,
        'email': customer.email,
        'mobile_phone': customer.mobile_phone,
        'order_id': order.id,
    }), 201


@auth.route('/login-facebook', methods=['POST'])
def login_facebook():
    data = request.json
    try:
        SignedRequest.parse(data['token'], current_app.config['SECRET_FB_APP_KEY'])
    except:
        return jsonify({'message' : 'invalid token'}), 403
    try:
        customer = Customer.query.filter_by(email=data['email'].lower()).first()
        if customer and customer.mobile_phone != data['mobile_phone']:
            customer.mobile_phone = data['mobile_phone']
        if customer is None:
            customer = Customer(
                email=data['email'].lower(),
                name=data['name'],
                mobile_phone=data['mobile_phone'])
        db.session.add(customer)
        db.session.commit()
    except:
        return jsonify({'message' : 'provide required data'}), 400

    return jsonify({
        'message' : 'facebook user logged',
        'token' : customer.generate_auth_token(expiration=86400),
        'name': customer.name,
        'email': customer.email,
        'mobile_phone': customer.mobile_phone
    }), 201

@auth.route('/login-google', methods=['POST'])
def login_google():
    data = request.json or {}
    credential = data.get('credential')
    if not credential:
        return jsonify({'message': 'credential required'}), 400

    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        idinfo = google_id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            os.getenv('GOOGLE_CLIENT_ID'),
        )
    except ValueError:
        return jsonify({'message': 'invalid google token'}), 403

    email = idinfo.get('email', '').lower()
    if not email:
        return jsonify({'message': 'email not provided by Google'}), 400

    name = idinfo.get('name') or idinfo.get('given_name') or email.split('@')[0]

    try:
        customer = Customer.query.filter_by(email=email).first()
        if customer is None:
            customer = Customer(email=email, name=name)
            db.session.add(customer)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'message': 'error creating user'}), 500

    return jsonify({
        'token': customer.generate_auth_token(expiration=86400),
        'name': customer.name,
        'email': customer.email,
        'mobile_phone': customer.mobile_phone,
    }), 200


@auth.route('/generate-carrier-company-token', methods=['POST'])
def quotation_token():
    data = request.json
    return jsonify({
        'token': CarrierCompanyEntity().generate_carrier_company_token(864000, data['order_id'], data['carrier_company_id']),
        'expiration': 864000,
    })