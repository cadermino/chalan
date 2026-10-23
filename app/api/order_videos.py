"""Videos de la carga de una orden, que sube un admin desde el backoffice.

El cliente los manda por WhatsApp y el transportista cotiza mejor viendo un
recorrido que unas fotos. El backoffice los sube en crear/editar orden y el
transportista los ve en su link de cotización (`quotation.vue`, a través de
`Order.details()`).

Van directo del navegador a S3 (presigned POST), como los archivos de las
solicitudes de servicio: un video de 250 MB no puede pasar por el proxy del
backoffice-api ni ocupar un worker. Quedan bajo `orders/`, que la política del
bucket ya abre a cualquiera, igual que las fotos de la orden.

Solo con token interno: el backoffice-api ya revisó el rol.
"""
import uuid

from flask import current_app, jsonify, request

from . import api
from .decorators import is_internal_request
from .service_request.validation import InvalidRequest, MEDIA_TYPES, VIDEO_MAX_BYTES
from .. import db
from ..models import Order, OrderVideo, OrderVideoSchema
from ..storage import get_storage

MAX_VIDEOS = 5
# content type -> extensión; mismos videos que acepta el formulario de servicios.
CONTENT_TYPES = {
    content_type: extension
    for content_type, (media_type, extension) in MEDIA_TYPES.items()
    if media_type == 'video'
}


def _forbidden():
    return jsonify({'message': 'forbidden'}), 403


def _not_found(what):
    return jsonify({'message': f'{what} not found'}), 404


def _key_prefix(order_id):
    return f'orders/{order_id}/video-'


def _check_upload(content_type, size_bytes):
    if content_type not in CONTENT_TYPES:
        raise InvalidRequest('only MP4, MOV and WEBM videos are allowed')
    if isinstance(size_bytes, bool) or not isinstance(size_bytes, int) or size_bytes < 1:
        raise InvalidRequest('size_bytes must be a positive integer')
    if size_bytes > VIDEO_MAX_BYTES:
        raise InvalidRequest(f'video too large (max {VIDEO_MAX_BYTES // (1024 * 1024)}MB)')


@api.route('/order/<int:order_id>/videos/presign', methods=['POST'])
def presign_order_video(order_id):
    if not is_internal_request():
        return _forbidden()
    if db.session.get(Order, order_id) is None:
        return _not_found('order')

    data = request.get_json(silent=True) or {}
    content_type = data.get('content_type')
    _check_upload(content_type, data.get('size_bytes'))
    if OrderVideo.query.filter_by(order_id=order_id).count() >= MAX_VIDEOS:
        raise InvalidRequest(f'at most {MAX_VIDEOS} videos per order')

    storage_key = f'{_key_prefix(order_id)}{uuid.uuid4().hex}.{CONTENT_TYPES[content_type]}'
    upload = get_storage().presigned_post(storage_key, content_type, VIDEO_MAX_BYTES)
    return jsonify({'upload': upload, 'storage_key': storage_key}), 200


@api.route('/order/<int:order_id>/videos', methods=['POST'])
def register_order_video(order_id):
    if not is_internal_request():
        return _forbidden()
    if db.session.get(Order, order_id) is None:
        return _not_found('order')

    data = request.get_json(silent=True) or {}
    storage_key = data.get('storage_key')
    prefix = _key_prefix(order_id)
    # Solo una llave que se le dio a esta orden: la de otra orden, o una ruta
    # que se salga del prefijo, no se registra aquí.
    if (not isinstance(storage_key, str) or not storage_key.startswith(prefix)
            or '/' in storage_key[len(prefix):] or '..' in storage_key):
        raise InvalidRequest('invalid storage_key')

    existing = OrderVideo.query.filter_by(storage_key=storage_key).first()
    if existing is not None:
        return jsonify(OrderVideoSchema().dump(existing)), 200

    storage = get_storage()
    stored = storage.head(storage_key)
    if stored is None:
        raise InvalidRequest('file was not uploaded')

    # El presigned POST ya fija tipo y tamaño; esto revisa lo que de verdad
    # quedó en el bucket, porque el registro es lo que el resto cree.
    problem = None
    try:
        _check_upload(stored['content_type'], stored['size'])
    except InvalidRequest as e:
        problem = str(e)
    if problem is None and OrderVideo.query.filter_by(order_id=order_id).count() >= MAX_VIDEOS:
        problem = f'at most {MAX_VIDEOS} videos per order'
    if problem is not None:
        storage.delete(storage_key)
        raise InvalidRequest(problem)

    video = OrderVideo(
        order_id=order_id,
        url=storage.public_url(storage_key),
        storage_key=storage_key,
        content_type=stored['content_type'],
        size_bytes=stored['size'],
    )
    db.session.add(video)
    db.session.commit()
    return jsonify(OrderVideoSchema().dump(video)), 201


@api.route('/order/<int:order_id>/videos/<int:video_id>', methods=['DELETE'])
def delete_order_video(order_id, video_id):
    if not is_internal_request():
        return _forbidden()
    video = OrderVideo.query.filter_by(id=video_id, order_id=order_id).first()
    if video is None:
        return _not_found('video')

    try:
        get_storage().delete(video.storage_key)
    except Exception as e:
        current_app.logger.error(f'Order video delete error: {e}')
        return jsonify({'message': 'Error deleting file'}), 500
    db.session.delete(video)
    db.session.commit()
    return '', 204
