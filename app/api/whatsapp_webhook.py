import json
from datetime import datetime
from flask import request, abort, Response
from . import api
from .. import db
from ..models import WhatsappMessage
from .whatsapp import validate_twilio_signature, lookup_contact, notify_inbound


@api.route('/whatsapp/webhook', methods=['POST'])
def whatsapp_webhook():
    if not validate_twilio_signature(request):
        abort(403)

    message_sid = request.form.get('MessageSid', '')
    from_raw = request.form.get('From', '')
    to_raw = request.form.get('To', '')
    body = request.form.get('Body', '')
    profile_name = request.form.get('ProfileName', '')
    num_media = int(request.form.get('NumMedia', 0))

    from_number = from_raw.replace('whatsapp:', '')
    to_number = to_raw.replace('whatsapp:', '')

    # idempotency
    if WhatsappMessage.query.filter_by(message_sid=message_sid).first():
        return Response('<Response/>', mimetype='application/xml')

    media_urls = None
    if num_media > 0:
        urls = [request.form.get(f'MediaUrl{i}') for i in range(num_media) if request.form.get(f'MediaUrl{i}')]
        media_urls = json.dumps(urls)

    contact = lookup_contact(from_number)

    msg = WhatsappMessage(
        message_sid=message_sid,
        direction='inbound',
        from_number=from_number,
        to_number=to_number,
        body=body,
        media_urls=media_urls,
        profile_name=profile_name,
        customer_id=contact['customer_id'],
        admin_user_id=contact['admin_user_id'],
        status='received',
        created_at=datetime.utcnow(),
    )
    db.session.add(msg)
    db.session.commit()

    notify_inbound(msg)

    return Response('<Response/>', mimetype='application/xml')


@api.route('/whatsapp/status', methods=['POST'])
def whatsapp_status():
    if not validate_twilio_signature(request):
        abort(403)

    message_sid = request.form.get('MessageSid', '')
    message_status = request.form.get('MessageStatus', '')
    error_code = request.form.get('ErrorCode')
    error_message = request.form.get('ErrorMessage')

    msg = WhatsappMessage.query.filter_by(message_sid=message_sid).first()
    if msg:
        msg.status = message_status
        if error_code:
            msg.error_code = error_code
        if error_message:
            msg.error_message = error_message
        db.session.commit()

    return Response('', status=204)
