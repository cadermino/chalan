import os
import re
import json
from datetime import datetime
from threading import Thread
from flask import current_app, request as flask_request


def normalize_phone(phone):
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


def validate_twilio_signature(req):
    auth_token = os.getenv('TWILIO_AUTH_TOKEN')
    if not auth_token:
        if os.getenv('FLASK_ENV') != 'prod':
            return True
        return False

    from twilio.request_validator import RequestValidator
    validator = RequestValidator(auth_token)

    proto = req.headers.get('X-Forwarded-Proto', req.scheme)
    host = req.headers.get('X-Forwarded-Host', req.host)
    url = f"{proto}://{host}{req.path}"
    signature = req.headers.get('X-Twilio-Signature', '')
    return validator.validate(url, req.form.to_dict(), signature)


def lookup_contact(phone_e164):
    from ..models import Customer
    from .. import db

    phone_variants = [phone_e164]
    if phone_e164.startswith('+'):
        phone_variants.append(phone_e164[1:])

    customer = Customer.query.filter(
        db.or_(
            Customer.mobile_phone.in_(phone_variants),
            Customer.phone.in_(phone_variants),
        )
    ).first()

    if customer:
        return {'customer_id': customer.id, 'admin_user_id': None}

    return {'customer_id': None, 'admin_user_id': None}


def send_whatsapp_freeform(to_e164, body, sent_by_admin_id=None):
    from twilio.rest import Client
    from twilio.base.exceptions import TwilioRestException
    from ..models import WhatsappMessage
    from .. import db

    account_sid = os.getenv('TWILIO_ACCOUNT_SID')
    auth_token = os.getenv('TWILIO_AUTH_TOKEN')
    whatsapp_from = os.getenv('TWILIO_WHATSAPP_FROM', '')
    if not whatsapp_from.startswith('whatsapp:'):
        whatsapp_from = 'whatsapp:' + whatsapp_from

    base_url = os.getenv('TWILIO_WEBHOOK_BASE_URL', '').rstrip('/')
    status_callback = f"{base_url}/api/v1/whatsapp/status" if base_url else None

    client = Client(account_sid, auth_token)
    kwargs = dict(
        from_=whatsapp_from,
        to='whatsapp:' + to_e164,
        body=body,
    )
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
        created_at=datetime.utcnow(),
    )
    db.session.add(msg)
    db.session.commit()
    print(f'[WhatsApp] Freeform enviado a {to_e164} sid={twilio_msg.sid}', flush=True)
    return msg


def notify_inbound_email(msg):
    from .email import send_email
    app = current_app._get_current_object()

    def _send(app, msg_id, from_number, profile_name, body, created_at):
        with app.app_context():
            try:
                display = profile_name or from_number
                send_email(
                    'cadermino@gmail.com',
                    f'[WhatsApp] Mensaje de {display}',
                    'email/whatsapp_inbound',
                    bcc=[],
                    from_number=from_number,
                    profile_name=profile_name,
                    body=body,
                    created_at=created_at,
                    backoffice_url=f"{os.getenv('SITE_URL', '')}/backoffice/whatsapp/{from_number}",
                )
            except Exception as e:
                print(f'[WhatsApp] Error enviando email de notificación: {e}', flush=True)

    thr = Thread(target=_send, args=[
        app, msg.id, msg.from_number, msg.profile_name, msg.body, msg.created_at
    ])
    thr.start()
    return thr


def _send_async(app, to_e164, content_sid, content_variables):
    with app.app_context():
        try:
            from twilio.rest import Client
            client = Client(
                os.getenv('TWILIO_ACCOUNT_SID'),
                os.getenv('TWILIO_AUTH_TOKEN'),
            )
            whatsapp_from = os.getenv('TWILIO_WHATSAPP_FROM', '')
            if not whatsapp_from.startswith('whatsapp:'):
                whatsapp_from = 'whatsapp:' + whatsapp_from
            client.messages.create(
                from_=whatsapp_from,
                to='whatsapp:' + to_e164,
                content_sid=content_sid,
                content_variables=json.dumps(content_variables),
            )
            print(f'[WhatsApp] Enviado a {to_e164} template={content_sid}', flush=True)
        except Exception as e:
            print(f'[WhatsApp] Error al enviar a {to_e164}: {e}', flush=True)


def send_whatsapp(phone, content_sid, content_variables):
    try:
        if not os.getenv('TWILIO_ACCOUNT_SID'):
            print('[WhatsApp] Skipped: TWILIO_ACCOUNT_SID no configurado', flush=True)
            return
        if not content_sid:
            print('[WhatsApp] Skipped: content_sid no configurado (template pendiente de aprobación)', flush=True)
            return
        to_e164 = normalize_phone(phone)
        if not to_e164:
            print(f'[WhatsApp] Skipped: teléfono inválido ({phone})', flush=True)
            return
        app = current_app._get_current_object()
        thr = Thread(target=_send_async, args=[app, to_e164, content_sid, content_variables])
        thr.start()
        return thr
    except Exception as e:
        print(f'[WhatsApp] Error inesperado: {e}', flush=True)
