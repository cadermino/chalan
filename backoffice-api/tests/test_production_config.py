"""El backoffice-api corría en el servidor con la configuración de desarrollo
(DEBUG, y SECRET_KEY cayendo a 'change-me-in-production' si faltaba)."""
import pytest

from config import ProductionConfig


def test_production_does_not_start_without_a_secret_key(monkeypatch):
    monkeypatch.delenv('SECRET_KEY', raising=False)

    with pytest.raises(RuntimeError):
        ProductionConfig.check()


def test_production_is_not_debug(monkeypatch):
    monkeypatch.setenv('SECRET_KEY', 'x' * 32)

    ProductionConfig.check()
    assert ProductionConfig.DEBUG is False


def test_the_seed_route_is_closed_outside_debug(client, app):
    app.debug = False

    assert client.post('/auth/seed', json={'email': 'a@b.c', 'password': 'x' * 8}).status_code == 404
