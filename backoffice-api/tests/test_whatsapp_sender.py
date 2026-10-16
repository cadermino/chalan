"""Responder por WhatsApp desde el número al que escribió el contacto.

La ventana de 24h de WhatsApp es de un par de números: una respuesta que sale
de otro número falla con 63016 aunque el contacto haya escrito hace segundos.
Pasó en producción: el backoffice-api tenía otro TWILIO_WHATSAPP_FROM que la
main API, que es la que recibe los mensajes.
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from app import db
from app.models import WhatsappMessage
from tests.test_service_requests import admin, make_user  # noqa: F401

CONTACT = '+51957417814'


@pytest.fixture
def twilio(monkeypatch):
    monkeypatch.setenv('TWILIO_ACCOUNT_SID', 'AC123')
    monkeypatch.setenv('TWILIO_AUTH_TOKEN', 'token')
    monkeypatch.setenv('TWILIO_WHATSAPP_FROM', '+15550000000')
    monkeypatch.setenv('TWILIO_TEMPLATE_CLIENTE', 'HX123')
    with patch('twilio.rest.Client') as client_cls:
        create = client_cls.return_value.messages.create
        create.return_value = MagicMock(sid='SM123')
        client_cls.return_value.content.v1.contents.return_value.fetch.return_value.types = {
            'twilio/text': {'body': 'Tienes una nueva cotización en Chalán: {{1}}'},
        }
        monkeypatch.setattr('app.api.whatsapp._template_texts', {})
        yield create


def inbound(to_number, minutes_ago):
    db.session.add(WhatsappMessage(
        direction='inbound', from_number=CONTACT, to_number=to_number, body='hola',
        channel='whatsapp', status='received',
        created_at=datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)))
    db.session.commit()


def test_a_reply_leaves_from_the_number_the_contact_last_wrote_to(client, admin, twilio):  # noqa: F811
    inbound('+17810000001', minutes_ago=90)
    inbound('+17814144961', minutes_ago=1)

    res = client.post('/api/whatsapp/send', json={'to': CONTACT, 'body': 'Buenas'}, headers=admin)

    assert res.status_code == 200
    assert twilio.call_args.kwargs['from_'] == 'whatsapp:+17814144961'
    assert WhatsappMessage.query.filter_by(direction='outbound').one().from_number == '+17814144961'


def test_a_template_also_leaves_from_the_contacts_number(client, admin, twilio):  # noqa: F811
    inbound('+17814144961', minutes_ago=60 * 48)

    res = client.post('/api/whatsapp/send-template',
                      json={'to': CONTACT, 'template': 'cliente', 'variables': {'1': 'x'}}, headers=admin)

    assert res.status_code == 200
    assert twilio.call_args.kwargs['from_'] == 'whatsapp:+17814144961'


def test_without_a_conversation_it_falls_back_to_the_setting(client, admin, twilio):  # noqa: F811
    res = client.post('/api/whatsapp/send', json={'to': CONTACT, 'body': 'Buenas'}, headers=admin)

    assert res.status_code == 200
    assert twilio.call_args.kwargs['from_'] == 'whatsapp:+15550000000'


def test_the_chat_shows_the_template_as_it_was_sent(client, admin, twilio):  # noqa: F811
    client.post('/api/whatsapp/send-template',
                json={'to': CONTACT, 'template': 'cliente', 'variables': {'1': 'https://chalan.pe/x'}},
                headers=admin)

    sent = WhatsappMessage.query.filter_by(direction='outbound').one()
    assert sent.body == ('[Plantilla: Mensaje a cliente]\n\n'
                         'Tienes una nueva cotización en Chalán: https://chalan.pe/x')
