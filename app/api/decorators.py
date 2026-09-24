
import datetime

import jwt
from flask import current_app, request
from functools import wraps
from ..models import Customer
from .carrier_company import CarrierCompany as CarrierCompanyEntity
from .errors import bad_request, unauthorized

# Marca los tokens que emite el backoffice-api para llamarse con esta API. No
# representan a un cliente: dicen "esto ya pasó por el control de rol del
# backoffice". Van firmados con el SECRET_KEY que ambas apps comparten, así que
# no hace falta una variable de entorno nueva en el servidor.
INTERNAL_SCOPE = 'internal'
INTERNAL_TOKEN_TTL = datetime.timedelta(minutes=5)


def generate_internal_token():
    payload = {
        'scope': INTERNAL_SCOPE,
        'exp': datetime.datetime.now(datetime.timezone.utc) + INTERNAL_TOKEN_TTL,
    }
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')


def _bearer_token():
    auth_headers = request.headers.get('Authorization', '').split()
    return auth_headers[1] if len(auth_headers) >= 2 else None


def is_internal_request():
    """True si la llamada viene del backoffice-api con un token interno vivo."""
    token = _bearer_token()
    if token is None:
        return False
    try:
        data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
    except jwt.InvalidTokenError:
        return False
    return data.get('scope') == INTERNAL_SCOPE


def authenticated_customer():
    """Cliente del token, o None si no vino, venció o no es válido.

    A diferencia de token_required, no corta la petición: sirve para rutas que
    tienen que seguir atendiendo a quien todavía no se registró, como los
    primeros pasos del formulario de mudanza.
    """
    token = _bearer_token()
    if token is None:
        return None
    return Customer.verify_auth_token(token)

def token_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        auth_headers = request.headers.get('Authorization', '').split()
        if len(auth_headers) < 2:
            return unauthorized('Missing token')
        customer = Customer.verify_auth_token(auth_headers[1])
        if customer is not None:
            return func(*args, **kwargs)
        return bad_request('Invalid token')
    return wrapper

def carrier_company_token_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        auth_headers = request.headers.get('Authorization', '').split()
        if len(auth_headers) < 2:
            return unauthorized('Missing token')
        data = CarrierCompanyEntity.verify_carrier_company_token(auth_headers[1])
        if data is not None:
            return func(*args, **kwargs)
        return bad_request('Invalid token')
    return wrapper