"""Las fotos y videos de un servicio, guardados y compartidos sin su public_id.

El public_id es la llave de la página de cotizaciones del cliente. Antes la
carpeta de cada archivo era `service-requests/<public_id>/`, así que el link de
una foto (que ven todas las empresas y que se copia para WhatsApp) llevaba esa
llave. La carpeta ahora sale del public_id firmado con SECRET_KEY: es fija para
cada servicio (el registro valida que un archivo sea suyo), pero no se puede
volver de ella al public_id. Lo de antes lo mueve `flask move-service-media`.

Para mandar las fotos y videos por WhatsApp a quien todavía no es empresa de la
plataforma (los contactos de Google Maps) hay un link con su propio token:
chalan.pe/v/<token>, que muestra solo el servicio, el distrito y los archivos.
El backoffice-api arma el mismo token (`backoffice-api/app/service_media.py`):
si cambia el formato aquí, hay que cambiarlo allá.
"""
import hashlib
import hmac

from flask import current_app
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

SALT = 'service-media'
# Como el link de las empresas: lo que dura una invitación a cotizar.
MAX_AGE = 30 * 24 * 3600


def _secret():
    secret = current_app.config['SECRET_KEY']
    return secret.encode() if isinstance(secret, str) else secret


def media_prefix(service_request):
    folder = hmac.new(_secret(), f'service-media:{service_request.public_id}'.encode(), hashlib.sha256)
    return f'service-requests/{folder.hexdigest()[:32]}/'


def legacy_prefix(service_request):
    """Donde estaban antes: todavía se acepta registrar ahí un archivo que se
    subió con una firma pedida antes del cambio."""
    return f'service-requests/{service_request.public_id}/'


def _serializer():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=SALT)


def make_token(service_request):
    return _serializer().dumps(service_request.id)


def read_token(token):
    """(service_request_id, None), o (None, 'expired' | 'invalid')."""
    try:
        return _serializer().loads(token, max_age=MAX_AGE), None
    except SignatureExpired:
        return None, 'expired'
    except (BadSignature, ValueError, TypeError):
        return None, 'invalid'
