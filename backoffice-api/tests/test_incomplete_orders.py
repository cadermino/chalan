"""Completar órdenes: a quien dejó su WhatsApp a medias, pedirle lo que falta.

Lo que se prueba es lo que haría escribirle mal: pedirle algo que ya dio, no
pedirle algo sin lo cual la orden no sale, escribirle por una orden que ya
resolvió con otra, o dos veces por el mismo número.
"""
from datetime import datetime, timedelta

import pytest

from app import db
from app.models import Customer, Order, OrderDetail
from tests.test_service_requests import make_user

MAP = 'https://maps.google.com/?cid=1'


@pytest.fixture
def superadmin(app):
    return make_user('superadmin')


def make_order(days_ago=1, addresses=True, chose_date=False, **fields):
    created = datetime.utcnow() - timedelta(days=days_ago)
    values = {'order_status_id': 1, 'created_date': created,
              'appointment_date': created + timedelta(days=5) if chose_date else created, **fields}
    order = Order(**values)
    db.session.add(order)
    db.session.commit()
    if addresses:
        db.session.add_all([
            OrderDetail(order_id=order.id, type='carry_from', floor_number=2, country='Perú', map_url=MAP,
                        street='Av. Arnaldo Márquez 1772, Jesús María 15072, Perú'),
            OrderDetail(order_id=order.id, type='deliver_to', floor_number=0, country='Perú', map_url=MAP,
                        street='Calle Los Pinos 120, Santiago de Surco 15038, Perú'),
        ])
        db.session.commit()
    return order


def incomplete(client, headers):
    res = client.get('/api/orders/incomplete', headers=headers)
    assert res.status_code == 200
    return res.get_json()['orders']


def test_a_visitor_who_only_left_a_number_is_asked_for_step_two_and_contact(client, superadmin):
    order = make_order(lead_phone='987654321')

    [row] = incomplete(client, superadmin)

    assert row['id'] == order.id
    assert row['missing'] == ['date', 'comments', 'contact']
    assert (row['phone'], row['customer_name']) == ('987654321', None)
    assert (row['origin_district'], row['destination_district']) == ('Jesús María', 'Santiago de Surco')
    assert 'street' not in row


def test_it_asks_only_for_what_is_missing(client, superadmin):
    customer = Customer(name='Ana', email='ana@example.com', mobile_phone='912345678')
    db.session.add(customer)
    db.session.commit()
    make_order(customer_id=customer.id, chose_date=True, comments='cama y refri', load_type='cargo')

    [row] = incomplete(client, superadmin)

    assert row['missing'] == ['cargo_weight']
    assert (row['phone'], row['customer_name']) == ('912345678', 'Ana')


def test_an_address_without_its_map_point_is_missing(client, superadmin):
    order = make_order(lead_phone='987654321', chose_date=True, comments='cajas')
    OrderDetail.query.filter_by(order_id=order.id, type='deliver_to').update({'map_url': None})
    db.session.commit()

    assert incomplete(client, superadmin)[0]['missing'] == ['destination', 'contact']


def test_left_out_without_phone_sent_old_or_not_pending(client, superadmin):
    make_order()                                                    # sin número
    make_order(lead_phone='900000001', quotation_requested=True)    # ya se mandó
    make_order(lead_phone='900000002', days_ago=31)                 # muy vieja
    make_order(lead_phone='900000003', order_status_id=4)           # cancelada

    assert incomplete(client, superadmin) == []


def test_one_row_per_number_the_newest(client, superadmin):
    make_order(lead_phone='987654321', days_ago=3)
    newest = make_order(lead_phone='+51 987 654 321', days_ago=1)

    [row] = incomplete(client, superadmin)

    assert (row['id'], row['orders_with_phone']) == (newest.id, 2)


def test_a_number_that_later_sent_an_order_is_left_out(client, superadmin):
    make_order(lead_phone='987654321', days_ago=3)
    make_order(lead_phone='987654321', days_ago=1, chose_date=True, comments='cajas', quotation_requested=True)
    later = make_order(lead_phone='912345678', days_ago=3)
    make_order(lead_phone='912345678', days_ago=5, quotation_requested=True)  # mandó antes, esta es nueva

    assert [r['id'] for r in incomplete(client, superadmin)] == [later.id]


def test_asking_sends_it_to_the_bottom(client, superadmin):
    older = make_order(lead_phone='987654321', days_ago=3)
    newer = make_order(lead_phone='912345678', days_ago=1)
    assert [r['id'] for r in incomplete(client, superadmin)] == [newer.id, older.id]

    for _ in range(2):
        res = client.post(f'/api/orders/{newer.id}/completion-asked', headers=superadmin)
    assert res.status_code == 200
    assert res.get_json()['ask_count'] == 2

    rows = incomplete(client, superadmin)
    assert [r['id'] for r in rows] == [older.id, newer.id]
    assert rows[1]['asked_at'].endswith('Z')


def test_only_admins(client):
    carrier = make_user('carrier_company')
    assert client.get('/api/orders/incomplete', headers=carrier).status_code == 403
    assert client.post('/api/orders/1/completion-asked', headers=carrier).status_code == 403


class FakeResponse:
    def __init__(self, status_code, body):
        self.status_code = status_code
        self._body = body

    def json(self):
        return self._body


def test_linking_a_customer_goes_to_the_main_api(client, superadmin, monkeypatch):
    seen = {}

    def fake_post(url, json, headers, timeout):
        seen.update(url=url, json=json, headers=headers)
        return FakeResponse(201, {'customer_id': 9, 'existing': False})
    monkeypatch.setattr('app.api.orders.requests.post', fake_post)
    monkeypatch.setenv('INTERNAL_API_URL', 'http://flask-api:8001')

    res = client.post('/api/orders/12/customer', headers=superadmin,
                      json={'name': 'Carla', 'email': 'carla@example.com', 'mobile_phone': '987654321', 'id': 3})

    assert res.status_code == 201
    assert seen['url'] == 'http://flask-api:8001/api/v1/order/12/customer'
    assert seen['json'] == {'name': 'Carla', 'email': 'carla@example.com', 'mobile_phone': '987654321'}
    assert seen['headers']['Authorization'].startswith('Bearer ')


def test_a_409_passes_through(client, superadmin, monkeypatch):
    monkeypatch.setattr('app.api.orders.requests.post',
                        lambda *a, **k: FakeResponse(409, {'message': 'order already has a customer'}))

    assert client.post('/api/orders/12/customer', headers=superadmin, json={}).status_code == 409


def test_only_superadmins_link_customers(client):
    admin = make_user('admin')
    assert client.post('/api/orders/12/customer', headers=admin, json={}).status_code == 403
