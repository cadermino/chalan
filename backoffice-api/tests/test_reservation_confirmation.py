"""Marcar la reserva como pagada pone la orden en marcha (vía el API principal).

El yapeo se verifica a mano: el cliente informa su número de operación y un
admin lo da por recibido. Ahí recién la orden pasa a in_progress y el
transportista se entera. La escritura vive en el API principal; acá se prueba
cuándo se la llama y que un fallo suyo no deshaga el pago ya verificado.
"""
from datetime import datetime

import pytest
import requests

from app import db
from app.models import Order, Payment
from tests.test_service_requests import FakeResponse, admin, make_user  # noqa: F401


def make_payment(concept, status='pending'):
    order = Order(order_status_id=1, created_date=datetime(2026, 10, 1))
    db.session.add(order)
    db.session.commit()
    payment = Payment(order_id=order.id, lu_payment_type_id=1, amount=20, concept=concept,
                      status=status, reference='12345678', active=1)
    db.session.add(payment)
    db.session.commit()
    return order, payment


def patch_payment(client, headers, order, payment, status):
    return client.patch(f'/api/orders/{order.id}/payments/{payment.id}',
                        headers=headers, json={'status': status})


@pytest.fixture
def main_api(monkeypatch):
    calls = []
    answer = {'value': FakeResponse(200, {'confirmed': True})}

    def fake_post(url, headers, timeout):
        calls.append({'url': url, 'headers': headers})
        if isinstance(answer['value'], Exception):
            raise answer['value']
        return answer['value']
    monkeypatch.setattr('app.api.orders.requests.post', fake_post)
    monkeypatch.setenv('INTERNAL_API_URL', 'http://flask-api:8001')
    return calls, answer


def test_paying_the_reservation_confirms_the_order(client, admin, main_api):
    calls, _ = main_api
    order, payment = make_payment('reservation')

    res = patch_payment(client, admin, order, payment, 'paid')

    assert res.status_code == 200
    assert res.get_json()['order_confirmation'] == 'ok'
    assert res.get_json()['payment']['status'] == 'paid'
    assert [c['url'] for c in calls] == [f'http://flask-api:8001/api/v1/order/{order.id}/confirm-reservation']
    assert calls[0]['headers']['Authorization'].startswith('Bearer ')


def test_an_already_confirmed_order_is_reported_unchanged(client, admin, main_api):
    _, answer = main_api
    answer['value'] = FakeResponse(200, {'confirmed': False})
    order, payment = make_payment('reservation')

    res = patch_payment(client, admin, order, payment, 'paid')

    assert res.get_json()['order_confirmation'] == 'unchanged'


@pytest.mark.parametrize('failure', [FakeResponse(502, {}), requests.ConnectionError()])
def test_a_main_api_failure_keeps_the_payment_and_flags_it(client, admin, main_api, failure):
    _, answer = main_api
    answer['value'] = failure
    order, payment = make_payment('reservation')

    res = patch_payment(client, admin, order, payment, 'paid')

    assert res.status_code == 200
    assert res.get_json()['order_confirmation'] == 'failed'
    assert db.session.get(Payment, payment.id).status == 'paid'


def test_only_a_paid_reservation_confirms_the_order(client, admin, main_api):
    calls, _ = main_api
    order, reservation = make_payment('reservation', status='paid')
    carrier_cash = Payment(order_id=order.id, lu_payment_type_id=1, amount=200,
                           concept='carrier_cash', status='pending', active=1)
    db.session.add(carrier_cash)
    db.session.commit()

    for payment, status in ((reservation, 'pending'), (reservation, 'cancelled'), (carrier_cash, 'paid')):
        res = patch_payment(client, admin, order, payment, status)
        assert res.status_code == 200
        assert 'order_confirmation' not in res.get_json()

    assert calls == []
