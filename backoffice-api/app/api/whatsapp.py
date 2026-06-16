import os
import re
import json
from datetime import datetime, timezone
from flask import jsonify, request, g
from sqlalchemy import case, func

from . import api
from .decorators import admin_required
from ..models import WhatsappMessage, Customer, AdminUser
from .. import db


def _normalize_phone(phone):
    if not phone:
        return None
    cleaned = re.sub(r'[\s\-\(\)]', '', str(phone))
    if cleaned.startswith('+'):
        return cleaned
    if cleaned.startswith('51') and len(cleaned) == 11:
        return '+' + cleaned
    if len(cleaned) == 9:
        return '+51' + cleaned
    return None


def _send_freeform(to_e164, body, sent_by_admin_id=None):
    from twilio.rest import Client
    from twilio.base.exceptions import TwilioRestException

    account_sid = os.getenv('TWILIO_ACCOUNT_SID')
    auth_token = os.getenv('TWILIO_AUTH_TOKEN')
    whatsapp_from = os.getenv('TWILIO_WHATSAPP_FROM', '')
    if not whatsapp_from.startswith('whatsapp:'):
        whatsapp_from = 'whatsapp:' + whatsapp_from

    base_url = os.getenv('TWILIO_WEBHOOK_BASE_URL', '').rstrip('/')
    status_callback = f"{base_url}/api/v1/whatsapp/status" if base_url else None

    client = Client(account_sid, auth_token)
    kwargs = dict(from_=whatsapp_from, to='whatsapp:' + to_e164, body=body)
    if status_callback:
        kwargs['status_callback'] = status_callback

    twilio_msg = client.messages.create(**kwargs)

    msg = WhatsappMessage(
        message_sid=twilio_msg.sid,
        direction='outbound',
        from_number=whatsapp_from.replace('whatsapp:', ''),
        to_number=to_e164,
        body=body,
        sent_by_admin_id=sent_by_admin_id,
        status='queued',
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(msg)
    db.session.commit()
    return msg


@api.route('/whatsapp/conversations', methods=['GET'])
@admin_required
def list_conversations():
    search = request.args.get('q', '').strip()

    contact_col = case(
        (WhatsappMessage.direction == 'inbound', WhatsappMessage.from_number),
        else_=WhatsappMessage.to_number,
    )

    subq = (
        db.session.query(
            contact_col.label('contact_number'),
            func.max(WhatsappMessage.id).label('last_id'),
        )
        .group_by(contact_col)
        .subquery()
    )

    rows = (
        db.session.query(WhatsappMessage, subq.c.contact_number)
        .join(subq, WhatsappMessage.id == subq.c.last_id)
        .order_by(WhatsappMessage.created_at.desc())
        .all()
    )

    result = []
    for msg, contact_number in rows:
        if search and search not in (contact_number or '') and search not in (msg.profile_name or ''):
            continue
        customer = None
        if msg.customer_id:
            customer = Customer.query.get(msg.customer_id)

        result.append({
            'contact_number': contact_number,
            'last_message_body': msg.body,
            'last_message_at': msg.created_at.isoformat() if msg.created_at else None,
            'direction': msg.direction,
            'profile_name': msg.profile_name,
            'customer_id': msg.customer_id,
            'customer_name': ' '.join(filter(None, [
                customer.name if customer else None,
                customer.paternal_last_name if customer else None,
            ])) or None,
        })

    return jsonify({'conversations': result}), 200


@api.route('/whatsapp/conversations/<path:phone>', methods=['GET'])
@admin_required
def get_conversation(phone):
    phone_e164 = _normalize_phone(phone) or phone
    phone_variants = [phone_e164]
    if phone_e164.startswith('+'):
        phone_variants.append(phone_e164[1:])

    messages = (
        WhatsappMessage.query
        .filter(
            db.or_(
                WhatsappMessage.from_number.in_(phone_variants),
                WhatsappMessage.to_number.in_(phone_variants),
            )
        )
        .order_by(WhatsappMessage.created_at.asc())
        .all()
    )

    return jsonify({'messages': [m.to_dict() for m in messages]}), 200


TEMPLATES = {
    'cliente': {
        'label': 'Mensaje a cliente',
        'env': 'TWILIO_TEMPLATE_CLIENTE',
        'variables': [
            {'key': '1', 'label': 'Nombre del cliente'},
            {'key': '2', 'label': 'URL de cotización'},
        ],
    },
    'transportista': {
        'label': 'Mensaje a transportista',
        'env': 'TWILIO_TEMPLATE_TRANSPORTISTA',
        'variables': [
            {'key': '1', 'label': 'URL de cotización'},
        ],
    },
}


@api.route('/whatsapp/send-template', methods=['POST'])
@admin_required
def send_template():
    data = request.get_json() or {}
    to_raw = data.get('to', '').strip()
    template_key = data.get('template', '').strip()
    variables = data.get('variables', {})

    to_e164 = _normalize_phone(to_raw)
    if not to_e164:
        return jsonify({'message': 'Número de teléfono inválido'}), 400

    tpl = TEMPLATES.get(template_key)
    if not tpl:
        return jsonify({'message': 'Plantilla no válida'}), 400

    content_sid = os.getenv(tpl['env'])
    if not content_sid:
        return jsonify({'message': f"La variable {tpl['env']} no está configurada"}), 500

    from twilio.rest import Client
    import json as _json
    try:
        account_sid = os.getenv('TWILIO_ACCOUNT_SID')
        auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        whatsapp_from = os.getenv('TWILIO_WHATSAPP_FROM', '')
        if not whatsapp_from.startswith('whatsapp:'):
            whatsapp_from = 'whatsapp:' + whatsapp_from

        client = Client(account_sid, auth_token)
        twilio_msg = client.messages.create(
            from_=whatsapp_from,
            to='whatsapp:' + to_e164,
            content_sid=content_sid,
            content_variables=_json.dumps(variables),
        )

        msg = WhatsappMessage(
            message_sid=twilio_msg.sid,
            direction='outbound',
            from_number=whatsapp_from.replace('whatsapp:', ''),
            to_number=to_e164,
            body=f'[Plantilla: {tpl["label"]}]',
            sent_by_admin_id=g.current_user.id,
            status='queued',
            created_at=datetime.now(timezone.utc),
        )
        db.session.add(msg)
        db.session.commit()
        return jsonify({'ok': True, 'message': msg.to_dict()}), 200
    except Exception as e:
        print(f'[WhatsApp] Error enviando template: {e}', flush=True)
        return jsonify({'message': 'Error al enviar la plantilla'}), 500


@api.route('/whatsapp/send', methods=['POST'])
@admin_required
def send_message():
    data = request.get_json() or {}
    to_raw = data.get('to', '').strip()
    body = data.get('body', '').strip()

    to_e164 = _normalize_phone(to_raw)
    if not to_e164:
        return jsonify({'message': 'Número de teléfono inválido'}), 400
    if not body:
        return jsonify({'message': 'El mensaje no puede estar vacío'}), 400
    if len(body) > 1600:
        return jsonify({'message': 'El mensaje excede 1600 caracteres'}), 400

    try:
        msg = _send_freeform(to_e164, body, sent_by_admin_id=g.current_user.id)
        return jsonify({'ok': True, 'message': msg.to_dict()}), 200
    except Exception as e:
        err_str = str(e)
        if '63016' in err_str:
            return jsonify({
                'message': 'Fuera de ventana de 24h. El usuario debe escribir primero o usa un template aprobado.'
            }), 400
        print(f'[WhatsApp] Error al enviar freeform: {e}', flush=True)
        return jsonify({'message': 'Error al enviar el mensaje'}), 500
