"""Código del link corto de reseña: chalan.pe/r/o<orden>-<firma> (mudanza) y
chalan.pe/r/s<solicitud>-<firma> (servicio).

Es el mismo que lee el API principal en `app/api/review_short_link.py`: misma
sal, misma SECRET_KEY, mismo formato. Si cambia allá hay que cambiarlo aquí (un
test del API principal los compara).
"""
import base64
import hashlib
import hmac

from flask import current_app

SALT = b'review-short-link'
SIGNATURE_LENGTH = 10
ORDER, SERVICE = 'o', 's'


def make_code(kind, subject_id):
    key = current_app.config['SECRET_KEY'].encode()
    digest = hmac.new(key, SALT + f':{kind}{subject_id}'.encode(), hashlib.sha256).digest()
    return f'{kind}{subject_id}-{base64.urlsafe_b64encode(digest).decode()[:SIGNATURE_LENGTH]}'


def review_short_path(kind, subject_id):
    return f'/r/{make_code(kind, subject_id)}'
