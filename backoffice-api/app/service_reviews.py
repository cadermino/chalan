"""Link de reseña de un servicio completado: el corto, chalan.pe/r/s<solicitud>-<firma>
(`review_short_link.py`), que el API principal canjea por el JWT de siempre
(/reviews/submit/<jwt>, `app/api/review_short_link.py`). La reseña la escribe el
API principal: `reviews` no tiene modelo en este API y se lee con SQL.
"""
from . import db
from .review_short_link import SERVICE, review_short_path

COMPLETED = 'completed'


def reviewed_ids(column, ids):
    """Cuáles de estas órdenes (`order_id`) o servicios (`service_request_id`)
    ya tienen la reseña del cliente: la columna Review de las listas."""
    if column not in ('order_id', 'service_request_id'):
        raise ValueError(column)
    if not ids:
        return set()
    rows = db.session.execute(
        db.text(f'SELECT DISTINCT {column} FROM reviews WHERE {column} IN :ids')
        .bindparams(db.bindparam('ids', expanding=True)),
        {'ids': list(ids)},
    )
    return {row[0] for row in rows}


def _reviewed_quotation(service_request):
    if service_request.status != COMPLETED:
        return None
    return next((q for q in service_request.quotations if q.status == 'selected'), None)


def review_path(service_request):
    if _reviewed_quotation(service_request) is None:
        return None
    return review_short_path(SERVICE, service_request.id)


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
