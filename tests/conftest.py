import pytest

from app import create_app, db
from app.models import CarrierCompany, Customer, Order


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
