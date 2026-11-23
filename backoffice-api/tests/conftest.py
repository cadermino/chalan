import pytest

from app import create_app, db


# `reviews` es del API principal y no tiene modelo aquí (se lee con SQL): las
# listas de órdenes y servicios la miran para la columna Review.
REVIEWS_TABLE = ('CREATE TABLE reviews (id INTEGER PRIMARY KEY, order_id INTEGER, customer_id INTEGER, '
                 'service_request_id INTEGER, carrier_company_id INTEGER, rating INTEGER, comment TEXT, '
                 'platform_rating INTEGER, platform_comment TEXT, created_date TEXT)')


@pytest.fixture
def app():
    application = create_app('testing')
    with application.app_context():
        db.session.execute(db.text('DROP TABLE IF EXISTS reviews'))
        db.session.execute(db.text(REVIEWS_TABLE))
        db.session.commit()
        yield application
        db.session.remove()
        db.session.execute(db.text('DROP TABLE IF EXISTS reviews'))
        db.session.commit()
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
