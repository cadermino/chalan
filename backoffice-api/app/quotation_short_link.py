"""Código del link corto para cotizar (chalan.pe/c/<orden>-<empresa>-<firma>).

Es el mismo que lee el API principal en `app/api/quotation_short_link.py`:
misma sal, misma SECRET_KEY, mismo formato. Si cambia allá hay que cambiarlo aquí.
"""
import base64
import hashlib
import hmac

from flask import current_app

SALT = b'quotation-short-link'
SIGNATURE_LENGTH = 10


def make_code(order_id, carrier_company_id):
    key = current_app.config['SECRET_KEY'].encode()
    digest = hmac.new(key, SALT + f':{order_id}-{carrier_company_id}'.encode(), hashlib.sha256).digest()
    return f'{order_id}-{carrier_company_id}-{base64.urlsafe_b64encode(digest).decode()[:SIGNATURE_LENGTH]}'
