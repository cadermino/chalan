"""Link de reseña de un servicio completado (chalan.pe/reviews/submit/<token>).

Es el mismo JWT que hace el API principal en
`app/api/service_request/reviews.py`: misma SECRET_KEY, `service_request_id`
y `carrier_company_id`, 30 días. Si cambia el formato allá hay que cambiarlo
aquí. La reseña la escribe el API principal: `reviews` no tiene modelo en este
API y se lee con SQL.
"""
from datetime import datetime, timedelta, timezone

import jwt
from flask import current_app

from . import db

COMPLETED = 'completed'
REVIEW_TTL = timedelta(days=30)


def _reviewed_quotation(service_request):
    if service_request.status != COMPLETED:
        return None
    return next((q for q in service_request.quotations if q.status == 'selected'), None)


def review_path(service_request):
    quotation = _reviewed_quotation(service_request)
    if quotation is None:
        return None
    now = datetime.now(timezone.utc)
    token = jwt.encode({
        'service_request_id': service_request.id,
        'carrier_company_id': quotation.carrier_company_id,
        'exp': now + REVIEW_TTL,
        'iat': now,
    }, current_app.config['SECRET_KEY'], algorithm='HS256')
    return f'/reviews/submit/{token}'


def review_of(service_request):
    """La reseña que dejó el cliente, o None. Solo se busca en un servicio
    completado: antes no puede haber una."""
    if service_request.status != COMPLETED:
        return None
    row = db.session.execute(
        db.text('SELECT rating, comment, platform_rating, platform_comment, created_date '
                'FROM reviews WHERE service_request_id = :id'),
        {'id': service_request.id},
    ).first()
    if row is None:
        return None
    created = row.created_date
    return {
        'rating': row.rating,
        'comment': row.comment,
        'platform_rating': row.platform_rating,
        'platform_comment': row.platform_comment,
        'created_date': created.isoformat() if hasattr(created, 'isoformat') else created,
    }
