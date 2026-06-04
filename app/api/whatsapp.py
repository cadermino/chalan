import os
import re
import json
from threading import Thread
from flask import current_app


def normalize_phone(phone):
    """Convert a Peru local number to E.164 format (+51XXXXXXXXX)."""
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
    """Send a WhatsApp template message. Skips if phone or Twilio config is missing."""
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
