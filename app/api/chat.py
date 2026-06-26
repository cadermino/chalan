from datetime import datetime, timezone
from flask import jsonify, request
from . import api
from ..models import WhatsappMessage
from .. import db

_WEB_TO = 'web'


def _web_from(session_id):
    return f'web:{session_id}'


def _msg_dict(m):
    return {
        'id': m.id,
        'direction': m.direction,
        'body': m.body,
        'status': m.status,
        'created_at': m.created_at.isoformat() if m.created_at else None,
    }


@api.route('/chat/messages', methods=['POST'])
def chat_send():
    data = request.get_json() or {}
    session_id = (data.get('session_id') or '').strip()
    body = (data.get('body') or '').strip()
    name = (data.get('name') or '').strip() or None

    if not session_id or len(session_id) > 32 or not session_id.isalnum():
        return jsonify({'message': 'session_id inválido'}), 400
    if not body:
        return jsonify({'message': 'El mensaje no puede estar vacío'}), 400
    if len(body) > 1000:
        return jsonify({'message': 'El mensaje excede 1000 caracteres'}), 400

    msg = WhatsappMessage(
        direction='inbound',
        from_number=_web_from(session_id),
        to_number=_WEB_TO,
        body=body,
        profile_name=name,
        channel='web',
        status='received',
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(msg)
    db.session.commit()
    return jsonify({'ok': True, 'message': _msg_dict(msg)}), 201


@api.route('/chat/messages/<session_id>', methods=['GET'])
def chat_get(session_id):
    if not session_id or len(session_id) > 32 or not session_id.isalnum():
        return jsonify({'message': 'session_id inválido'}), 400

    web_from = _web_from(session_id)
    messages = (
        WhatsappMessage.query
        .filter(
            db.or_(
                WhatsappMessage.from_number == web_from,
                WhatsappMessage.to_number == web_from,
            )
        )
        .order_by(WhatsappMessage.created_at.asc())
        .all()
    )
    return jsonify({'messages': [_msg_dict(m) for m in messages]}), 200
