"""Fuera de producción no sale ningún WhatsApp.

El local y los e2e usan las mismas credenciales de Twilio, y el transportista
de prueba tiene un teléfono real.
"""
import pytest

from app.api import whatsapp


@pytest.fixture
def twilio(monkeypatch):
    monkeypatch.setenv('TWILIO_ACCOUNT_SID', 'AC-test')
    sent = []
    monkeypatch.setattr(whatsapp, '_send_async', lambda app, to, sid, *a: sent.append((to, sid)))
    return sent


def test_outside_prod_the_template_is_not_sent(app, twilio, monkeypatch):
    monkeypatch.setenv('FLASK_ENV', 'development')

    assert whatsapp.send_whatsapp('987654321', 'HX123', {'1': 'x'}) is None
    assert twilio == []


def test_in_prod_the_template_is_sent(app, twilio, monkeypatch):
    monkeypatch.setenv('FLASK_ENV', 'prod')

    whatsapp.send_whatsapp('987654321', 'HX123', {'1': 'x'}).join()

    assert twilio == [('+51987654321', 'HX123')]


def test_outside_prod_a_freeform_is_not_sent(app, monkeypatch):
    monkeypatch.setenv('FLASK_ENV', 'development')
    monkeypatch.setattr('twilio.rest.Client', lambda *a, **kw: pytest.fail('Twilio was called'))

    assert whatsapp.send_whatsapp_freeform('+51987654321', 'hola') is None
