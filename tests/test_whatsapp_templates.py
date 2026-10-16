"""El chat del backoffice muestra la plantilla tal como le llegó a la persona.

Twilio envía el texto que aprobó Meta; antes el mensaje guardado solo tenía la
etiqueta ("[Plantilla: Nueva cotización Chalán]").
"""
from unittest.mock import MagicMock

import pytest

from app.api.whatsapp import render_template, with_template_text


@pytest.fixture(autouse=True)
def empty_cache(monkeypatch):
    monkeypatch.setattr('app.api.whatsapp._template_texts', {})


def twilio_with(types):
    client = MagicMock()
    client.content.v1.contents.return_value.fetch.return_value.types = types
    return client


def test_fills_in_the_variables():
    client = twilio_with({'twilio/text': {'body': 'Hay una nueva solicitud de {{1}}: {{2}}'}})

    text = render_template(client, 'HX1', {'1': 'embalaje', '2': 'https://chalan.pe/s/1'})

    assert text == 'Hay una nueva solicitud de embalaje: https://chalan.pe/s/1'


def test_a_button_link_goes_under_the_text():
    client = twilio_with({'twilio/call-to-action': {
        'body': 'Tienes una nueva cotización',
        'actions': [{'type': 'URL', 'title': 'Ver', 'url': 'https://chalan.pe/{{1}}'}],
    }})

    assert render_template(client, 'HX1', {'1': 'order/step-three'}) == (
        'Tienes una nueva cotización\nhttps://chalan.pe/order/step-three')


def test_the_text_is_fetched_once_per_template():
    client = twilio_with({'twilio/text': {'body': 'Hola {{1}}'}})

    render_template(client, 'HX1', {'1': 'a'})
    assert render_template(client, 'HX1', {'1': 'b'}) == 'Hola b'
    assert client.content.v1.contents.return_value.fetch.call_count == 1


def test_if_twilio_fails_only_the_label_is_kept():
    client = MagicMock()
    client.content.v1.contents.return_value.fetch.side_effect = Exception('boom')

    text = render_template(client, 'HX1', {'1': 'a'})

    assert text is None
    assert with_template_text('[Plantilla: X]', text) == '[Plantilla: X]'
    assert with_template_text('[Plantilla: X]', 'Hola') == '[Plantilla: X]\n\nHola'
