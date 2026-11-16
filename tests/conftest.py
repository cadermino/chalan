import logging
from logging.handlers import SMTPHandler

import pytest

from app import create_app, db
from app.models import CarrierCompany, Customer, Order


@pytest.fixture(autouse=True)
def _no_error_emails():
    # tests/test_config.py arma una app de producción, y ProductionConfig le
    # cuelga al logger `app` (uno solo por proceso) un SMTPHandler que manda
    # cada error por correo con las credenciales reales del contenedor. Sin
    # esto, cualquier test que después registrara un error le llegaba a
    # ADMIN_MAIL como "[chalan] Application Error".
    logger = logging.getLogger('app')
    for handler in [h for h in logger.handlers if isinstance(h, SMTPHandler)]:
        logger.removeHandler(handler)
    yield
    for handler in [h for h in logger.handlers if isinstance(h, SMTPHandler)]:
        logger.removeHandler(handler)


@pytest.fixture
def app():
    application = create_app('testing')
    with application.app_context():
        db.create_all()
        yield application
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def customer(app):
    customer = Customer(name='Nathalia', paternal_last_name='Caceres', email='nathalia@example.com')
    db.session.add(customer)
    db.session.commit()
    return customer


@pytest.fixture
def carrier_company(app):
    company = CarrierCompany(name='Jhon Romero', active=1)
    db.session.add(company)
    db.session.commit()
    return company


@pytest.fixture
def order(app, customer):
    order = Order(customer_id=customer.id)
    db.session.add(order)
    db.session.commit()
    return order
