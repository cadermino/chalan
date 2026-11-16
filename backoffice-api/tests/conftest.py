import pytest

from app import create_app, db


@pytest.fixture
def app():
    application = create_app('testing')
    with application.app_context():
        yield application
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture(autouse=True)
def _no_order_version_call(monkeypatch):
    # El PUT de una orden le pide al API principal que guarde la versión
    # (_record_order_version). Sin esto, cada test de ese PUT haría una llamada
    # HTTP de verdad al INTERNAL_API_URL del contenedor, que es el flask de
    # desarrollo. tests/test_order_changes.py la prueba con la función real.
    monkeypatch.setattr('app.api.orders._record_order_version', lambda *args: None)
