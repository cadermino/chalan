"""Link para crear una contraseña nueva del backoffice (chalan.pe/backoffice/restablecer/<token>).

Lleva el id del usuario y una huella de su contraseña actual, firmados con
SECRET_KEY. Al guardar la nueva, la huella cambia y el link deja de servir: es
de un solo uso sin tabla de tokens. El que llega por correo sirve 1 hora; el
que un superadmin copia en Usuarios para mandarlo por WhatsApp, 24 horas (los
transportistas leen más el WhatsApp que el correo).
"""
import hashlib
import os
import time

from flask import current_app
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from . import db
from .models import AdminUser

SALT = 'password-reset'
EMAIL = 'e'
ADMIN_LINK = 'w'
MAX_AGE = {EMAIL: 3600, ADMIN_LINK: 24 * 3600}


def _serializer():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=SALT)


def _fingerprint(user):
    # Del hash y no del hash mismo: el link va en un correo o un WhatsApp.
    return hashlib.sha256(user.password_hash.encode()).hexdigest()[:12]


def make_token(user, via=EMAIL):
    return _serializer().dumps([user.id, _fingerprint(user), via])


def reset_url(token):
    site = os.environ.get('SITE_URL', 'https://chalan.pe/').rstrip('/')
    return f'{site}/backoffice/restablecer/{token}'


def read_token(token):
    """(usuario, None), o (None, motivo): 'expired', 'used' o 'invalid'."""
    try:
        (user_id, fingerprint, via), signed_at = _serializer().loads(
            token, max_age=max(MAX_AGE.values()), return_timestamp=True)
    except SignatureExpired:
        return None, 'expired'
    except (BadSignature, ValueError, TypeError):
        return None, 'invalid'
    if via not in MAX_AGE:
        return None, 'invalid'
    if time.time() - signed_at.timestamp() > MAX_AGE[via]:
        return None, 'expired'
    user = db.session.get(AdminUser, user_id)
    if user is None or not user.active:
        return None, 'invalid'
    if fingerprint != _fingerprint(user):
        return None, 'used'
    return user, None
