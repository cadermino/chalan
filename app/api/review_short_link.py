"""Link corto de reseña: chalan.pe/r/o<orden>-<firma> (mudanza) y
chalan.pe/r/s<solicitud>-<firma> (servicio).

El link de reseña de siempre (/reviews/submit/<jwt>) mide unos 250 caracteres y
va en un WhatsApp al cliente. Este lleva solo el número y una firma corta (HMAC
con SECRET_KEY, sal propia): no se puede cambiar el número para reseñar otra
mudanza. La empresa y el cliente no van en el código: se leen al canjearlo, así
que el link sigue a la cotización elegida. Next
(`frontend-react/src/app/r/[code]/page.tsx`) lo canjea aquí por el JWT de
siempre y redirige a /reviews/submit/<jwt>; desde ahí todo sigue igual, también
lo que revisa `_read_review_token`.

El backoffice-api arma los mismos códigos (`backoffice-api/app/review_short_link.py`):
si cambia el formato aquí, hay que cambiarlo allá (un test los compara).
"""
import base64
import hashlib
import hmac
import re
from datetime import datetime, timedelta, timezone

import jwt
from flask import current_app, jsonify

from . import api
from .errors import not_found
from .order.order_status import OrderStatus
from .quotation.quotation_status import QuotationStatus
from .service_request.reviews import make_review_token
from ..models import Order, Quotations, ServiceRequest
from .. import db

SALT = b'review-short-link'
SIGNATURE_LENGTH = 10
ORDER, SERVICE = 'o', 's'
# Lo mismo que el link largo que da el backoffice.
REVIEW_TTL = timedelta(days=30)
_CODE = re.compile(r'^([os])(\d+)-([A-Za-z0-9_-]+)$')


def _signature(kind, subject_id):
    key = current_app.config['SECRET_KEY'].encode()
    digest = hmac.new(key, SALT + f':{kind}{subject_id}'.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode()[:SIGNATURE_LENGTH]


def make_code(kind, subject_id):
    return f'{kind}{subject_id}-{_signature(kind, subject_id)}'


def read_code(code):
    """(kind, id), o None si el código no es nuestro."""
    match = _CODE.match(code or '')
    if not match:
        return None
    kind, subject_id = match.group(1), int(match.group(2))
    if not hmac.compare_digest(match.group(3), _signature(kind, subject_id)):
        return None
    return kind, subject_id


def _order_review_token(order):
    """El mismo JWT que `_generate_review_token` del backoffice-api, para la
    orden completada con su cotización elegida; None si todavía no se puede
    reseñar."""
    if order is None or not order.customer_id or order.order_status_id != OrderStatus.completed():
        return None
    selected = Quotations.query.filter_by(order_id=order.id, quotation_status_id=QuotationStatus.Selected()).first()
    if selected is None:
        return None
    now = datetime.now(timezone.utc)
    return jwt.encode({
        'purpose': 'review',
        'order_id': order.id,
        'customer_id': order.customer_id,
        'carrier_company_id': selected.carrier_company_id,
        'exp': now + REVIEW_TTL,
        'iat': now,
    }, current_app.config['SECRET_KEY'], algorithm='HS256')


@api.route('/review-links/<code>', methods=['GET'])
def redeem_review_short_link(code):
    target = read_code(code)
    if target is None:
        return not_found('link not found')
    kind, subject_id = target
    if kind == ORDER:
        token = _order_review_token(db.session.get(Order, subject_id))
    else:
        token = make_review_token(db.session.get(ServiceRequest, subject_id))
    if token is None:
        return not_found('link not found')
    return jsonify({'token': token}), 200
