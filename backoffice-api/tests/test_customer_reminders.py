"""El recordatorio por WhatsApp a los clientes que tienen cotizaciones y no eligieron.

Lo que se prueba es lo que haría mandar un recordatorio equivocado: a quien ya
eligió o no tiene nada que elegir, con un precio distinto del que ve en su
página, o a un número que no es el de ese pedido.
"""
from datetime import datetime, timedelta

import pytest
from itsdangerous import URLSafeTimedSerializer

from app import db
from app.models import AdminUser, Customer, Order, OrderDetail, Quotation, ReferredOrder, Vehicle
from tests.test_service_requests import make_user
from tests.test_services_per_company import catalog, make_company  # noqa: F401


@pytest.fixture
def superadmin(app):
    return make_user('superadmin')


@pytest.fixture
def customer(app):
    customer = Customer(name='Ana', email='ana@example.com', mobile_phone='987654321')
    db.session.add(customer)
    db.session.commit()
    return customer


def make_carrier(name, vehicle=True):
    company = make_company(name, 'moving')
    if vehicle:
        db.session.add(Vehicle(carrier_company_id=company.id, active=1))
        db.session.commit()
    return company


def make_order(customer, days_ahead=3, **fields):
    values = {'order_status_id': 1, 'customer_id': customer.id,
              'appointment_date': datetime.now() + timedelta(days=days_ahead), **fields}
    order = Order(**values)
    db.session.add(order)
    db.session.commit()
    db.session.add_all([
        OrderDetail(order_id=order.id, type='carry_from', street='Av. Arnaldo Márquez 1772, Jesús María 15072, Perú'),
        OrderDetail(order_id=order.id, type='deliver_to', street='Calle Los Pinos 120, Santiago de Surco 15038, Perú'),
    ])
    db.session.commit()
    return order


def quote(order, company, amount, status=1):
    db.session.add(Quotation(order_id=order.id, carrier_company_id=company.id, amount=amount,
                             quotation_status_id=status, created_date=datetime.now()))
    db.session.commit()


def reminders(client, headers):
    res = client.get('/api/orders/customer-reminders', headers=headers)
    assert res.status_code == 200
    return res.get_json()['orders']


def test_the_lowest_price_is_the_one_the_customer_sees(client, catalog, superadmin, customer, monkeypatch):
    monkeypatch.setenv('PLATFORM_FEE', '0.1')
    order = make_order(customer)
    quote(order, make_carrier('Cara SAC'), 400)
    quote(order, make_carrier('Barata SAC'), 200)
    quote(order, make_carrier('Retiró SAC'), 100, status=3)
    quote(order, make_carrier('Sin camión SAC', vehicle=False), 50)   # el cliente no la ve

    [row] = reminders(client, superadmin)

    assert row['id'] == order.id
    assert (row['quotations_count'], row['lowest_total']) == (2, 220.0)
    assert (row['customer_name'], row['phone'], row['past']) == ('Ana', '987654321', False)
    assert (row['origin_district'], row['destination_district']) == ('Jesús María', 'Santiago de Surco')
    assert 'street' not in row


def test_a_referred_order_adds_the_agent_commission(client, catalog, superadmin, customer, monkeypatch):
    monkeypatch.setenv('PLATFORM_FEE', '0.1')
    agent = AdminUser(email='agente@example.com', role='real_estate_agent', active=1, commission_rate=0.05)
    agent.password = 'testpass123'
    db.session.add(agent)
    order = make_order(customer)
    db.session.add(ReferredOrder(admin_user_id=agent.id, order_id=order.id))
    db.session.commit()
    quote(order, make_carrier('Mudanzas SAC'), 200)

    assert reminders(client, superadmin)[0]['lowest_total'] == 230.0


def test_the_phone_of_this_order_comes_first(client, catalog, superadmin, customer):
    order = make_order(customer, lead_phone='912345678')
    quote(order, make_carrier('Mudanzas SAC'), 200)

    assert reminders(client, superadmin)[0]['phone'] == '912345678'


def test_only_orders_with_something_to_choose(client, catalog, superadmin, customer):
    company = make_carrier('Mudanzas SAC')
    waiting = make_order(customer, days_ahead=5)
    past = make_order(customer, days_ahead=-10)
    picked = make_order(customer)
    scheduled = make_order(customer, order_status_id=2)
    nothing = make_order(customer)
    only_cancelled = make_order(customer)
    for order in (waiting, past, scheduled):
        quote(order, company, 200)
    quote(picked, company, 200, status=2)
    quote(picked, make_carrier('Otra SAC'), 300)
    quote(only_cancelled, company, 200, status=3)

    rows = reminders(client, superadmin)

    assert [(r['id'], r['past']) for r in rows] == [(waiting.id, False), (past.id, True)]
    assert nothing.id not in [r['id'] for r in rows]


def test_the_link_opens_the_order_for_its_customer(app, client, catalog, superadmin, customer):
    order = make_order(customer)
    quote(order, make_carrier('Mudanzas SAC'), 200)

    token = reminders(client, superadmin)[0]['token']

    serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'], salt='order-access')
    assert serializer.loads(token) == [order.id, customer.id]


def test_upcoming_first_then_the_most_recent_past_ones(client, catalog, superadmin, customer):
    company = make_carrier('Mudanzas SAC')
    orders = {days: make_order(customer, days_ahead=days) for days in (-30, -2, 1, 6)}
    for order in orders.values():
        quote(order, company, 200)

    assert [r['id'] for r in reminders(client, superadmin)] == [orders[d].id for d in (1, 6, -2, -30)]


def test_marking_it_reminded_sends_it_to_the_bottom(client, catalog, superadmin, customer):
    company = make_carrier('Mudanzas SAC')
    first = make_order(customer, days_ahead=1)
    second = make_order(customer, days_ahead=2)
    quote(first, company, 200)
    quote(second, company, 200)

    res = client.post(f'/api/orders/{first.id}/customer-reminded', headers=superadmin)
    assert res.status_code == 200
    client.post(f'/api/orders/{first.id}/customer-reminded', headers=superadmin)

    rows = reminders(client, superadmin)
    assert [r['id'] for r in rows] == [second.id, first.id]
    assert (rows[1]['reminder_count'], rows[1]['reminded_at'].endswith('Z')) == (2, True)
    assert db.session.get(Order, first.id).customer_reminder_count == 2


def test_only_admins(client, catalog, customer):
    company = make_carrier('Mudanzas SAC')
    carrier = make_user('carrier_company', carrier_company_id=company.id, suffix='c')
    order = make_order(customer)

    assert client.get('/api/orders/customer-reminders', headers=carrier).status_code == 403
    assert client.post(f'/api/orders/{order.id}/customer-reminded', headers=carrier).status_code == 403
