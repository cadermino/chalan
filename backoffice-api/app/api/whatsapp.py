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


_template_texts = {}


def _render_template(client, content_sid, content_variables):
    """The template's text with its variables filled in, for the chat.

    Same as render_template in the main API, which sends the automatic ones.
    """
    if content_sid not in _template_texts:
        try:
            types = client.content.v1.contents(content_sid).fetch().types or {}
        except Exception as e:
            print(f'[WhatsApp] No se pudo leer el texto de {content_sid}: {e}', flush=True)
            return None
        parts = []
        for content in types.values():
            if content.get('body'):
                parts.append(content['body'])
                parts += [a['url'] for a in content.get('actions') or [] if a.get('url')]
                break
        _template_texts[content_sid] = '\n'.join(parts)
    text = _template_texts[content_sid]
    for key, value in (content_variables or {}).items():
        text = text.replace('{{%s}}' % key, str(value))
    return text or None


def _sender_for(to_e164):
    """The number this contact last wrote to, or TWILIO_WHATSAPP_FROM if none.

    WhatsApp's 24h window belongs to a pair of numbers: a reply from any other
    sender fails with 63016 even seconds after the contact wrote. Each app reads
    TWILIO_WHATSAPP_FROM from its own env file, so the setting alone can drift.
    """
    last_inbound = (
        WhatsappMessage.query
        .filter(WhatsappMessage.direction == 'inbound',
                WhatsappMessage.channel == 'whatsapp',
                WhatsappMessage.from_number.in_([to_e164, to_e164.lstrip('+')]))
        .order_by(WhatsappMessage.created_at.desc())
        .first()
    )
    sender = last_inbound.to_number if last_inbound else os.getenv('TWILIO_WHATSAPP_FROM', '')
    return sender if sender.startswith('whatsapp:') else 'whatsapp:' + sender


def _send_freeform(to_e164, body, sent_by_admin_id=None):
    from twilio.rest import Client

    account_sid = os.getenv('TWILIO_ACCOUNT_SID')
    auth_token = os.getenv('TWILIO_AUTH_TOKEN')
    whatsapp_from = _sender_for(to_e164)

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
        profile_name = msg.profile_name
        if not profile_name:
            inbound = (
                WhatsappMessage.query
                .filter(
                    db.or_(
                        WhatsappMessage.from_number == contact_number,
                        WhatsappMessage.to_number == contact_number,
                    ),
                    WhatsappMessage.direction == 'inbound',
                    WhatsappMessage.profile_name.isnot(None),
                )
                .order_by(WhatsappMessage.id.desc())
                .first()
            )
            profile_name = inbound.profile_name if inbound else None

        if search and search not in (contact_number or '') and search not in (profile_name or ''):
            continue

        customer = None
        if msg.customer_id:
            customer = Customer.query.get(msg.customer_id)

        last_at = msg.created_at
        result.append({
            'contact_number': contact_number,
            'last_message_body': msg.body,
            'last_message_at': (last_at.isoformat() + '+00:00') if last_at else None,
            'direction': msg.direction,
            'profile_name': profile_name,
            'customer_id': msg.customer_id,
            'customer_name': ' '.join(filter(None, [
                customer.name if customer else None,
                customer.paternal_last_name if customer else None,
            ])) or None,
            'channel': msg.channel or 'whatsapp',
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
            {'key': '1', 'label': 'URL de cotización'},
        ],
    },
    'transportista': {
        'label': 'Mensaje a transportista',
        'env': 'TWILIO_TEMPLATE_TRANSPORTISTA',
        'variables': [
            {'key': '1', 'label': 'URL de cotización'},
        ],
    },
    'transportista_cambio': {
        'label': 'Orden cambió (transportista)',
        'env': 'TWILIO_TEMPLATE_TRANSPORTISTA_CAMBIO',
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
        whatsapp_from = _sender_for(to_e164)

        client = Client(account_sid, auth_token)
        twilio_msg = client.messages.create(
            from_=whatsapp_from,
            to='whatsapp:' + to_e164,
            content_sid=content_sid,
            content_variables=_json.dumps(variables),
        )
        label = f'[Plantilla: {tpl["label"]}]'
        text = _render_template(client, content_sid, variables)

        msg = WhatsappMessage(
            message_sid=twilio_msg.sid,
            direction='outbound',
            from_number=whatsapp_from.replace('whatsapp:', ''),
            to_number=to_e164,
            body=f'{label}\n\n{text}' if text else label,
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

    if not body:
        return jsonify({'message': 'El mensaje no puede estar vacío'}), 400

    if to_raw.startswith('web:'):
        if len(body) > 1000:
            return jsonify({'message': 'El mensaje excede 1000 caracteres'}), 400
        msg = WhatsappMessage(
            direction='outbound',
            from_number='web',
            to_number=to_raw,
            body=body,
            channel='web',
            sent_by_admin_id=g.current_user.id,
            status='delivered',
            created_at=datetime.now(timezone.utc),
        )
        db.session.add(msg)
        db.session.commit()
        return jsonify({'ok': True, 'message': msg.to_dict()}), 200

    to_e164 = _normalize_phone(to_raw)
    if not to_e164:
        return jsonify({'message': 'Número de teléfono inválido'}), 400
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
