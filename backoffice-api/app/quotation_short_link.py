"""Código del link corto para cotizar (chalan.pe/c/<orden>-<empresa>-<firma>), y el
de las solicitudes de servicio (chalan.pe/s/<solicitud>-<empresa>-<firma>, otra sal).

Es el mismo que lee el API principal en `app/api/quotation_short_link.py`:
misma sal, misma SECRET_KEY, mismo formato. Si cambia allá hay que cambiarlo aquí.
"""
import base64
import hashlib
import hmac

from flask import current_app

SALT = b'quotation-short-link'
SERVICE_SALT = b'service-quotation-short-link'
SIGNATURE_LENGTH = 10


def make_code(order_id, carrier_company_id, salt=SALT):
    key = current_app.config['SECRET_KEY'].encode()
    digest = hmac.new(key, salt + f':{order_id}-{carrier_company_id}'.encode(), hashlib.sha256).digest()
    return f'{order_id}-{carrier_company_id}-{base64.urlsafe_b64encode(digest).decode()[:SIGNATURE_LENGTH]}'


def make_service_code(service_request_id, carrier_company_id):
    return make_code(service_request_id, carrier_company_id, SERVICE_SALT)
