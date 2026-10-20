"""Link de acceso a una orden: abre las cotizaciones sin pedir contraseña.

La sesión del cliente dura 24 horas y no hay recuperación de contraseña, así
que quien volvía por el aviso de "nueva cotización" al día siguiente, o desde
otro celular, chocaba con el login. Este link lleva la orden y su cliente
firmados con SECRET_KEY; el API lo canjea por una sesión normal
(`POST /api/auth/order-access`).

Es corto a propósito (itsdangerous en vez de un JWT) porque va dentro de un
WhatsApp. El backoffice-api arma el mismo token con la misma sal
(`backoffice-api/app/order_access.py`) para el botón "Copiar link del cliente":
si cambia el formato aquí, hay que cambiarlo allá.
"""
import os

from flask import current_app
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

SALT = 'order-access'
# Una mudanza se cotiza con semanas de anticipación: el link tiene que seguir
# sirviendo hasta el día de la mudanza.
MAX_AGE = 60 * 24 * 3600


def _serializer():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=SALT)


def make_token(order):
    return _serializer().dumps([order.id, order.customer_id])


def order_access_url(order):
    site = (os.getenv('SITE_URL') or '').rstrip('/')
    return f'{site}/acceso/{make_token(order)}'


def read_token(token):
    """(order_id, customer_id) del token, o (None, motivo) si no sirve.

    El motivo es 'expired' o 'invalid', para que la pantalla diga cuál.
    """
    try:
        order_id, customer_id = _serializer().loads(token, max_age=MAX_AGE)
    except SignatureExpired:
        return None, 'expired'
    except (BadSignature, ValueError, TypeError):
        return None, 'invalid'
    return (order_id, customer_id), None
