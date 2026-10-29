"""Reseñas de servicios: el link que se le manda al cliente al terminar.

El token es un JWT con el SECRET_KEY, como el de las mudanzas
(`_generate_review_token` en backoffice-api orders.py), pero con
`service_request_id` en vez de `order_id`: así /reviews/verify y /reviews
saben cuál es. backoffice-api `app/service_reviews.py` hace el mismo token:
si cambia uno, cambian los dos."""
from datetime import datetime, timedelta, timezone

import jwt
from flask import current_app

from .statuses import COMPLETED

REVIEW_TTL = timedelta(days=30)


def reviewed_quotation(service_request):
    """La que se puede reseñar: la elegida de un servicio completado (el admin
    registró el saldo). Antes de eso el trabajo no se hizo."""
    if service_request is None or service_request.status != COMPLETED:
        return None
    return next((q for q in service_request.quotations if q.status == 'selected'), None)


def make_review_token(service_request):
    quotation = reviewed_quotation(service_request)
    if quotation is None:
        return None
    now = datetime.now(timezone.utc)
    payload = {
        'service_request_id': service_request.id,
        'carrier_company_id': quotation.carrier_company_id,
        'exp': now + REVIEW_TTL,
        'iat': now,
    }
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')


def review_path(service_request):
    token = make_review_token(service_request)
    return f'/reviews/submit/{token}' if token else None
