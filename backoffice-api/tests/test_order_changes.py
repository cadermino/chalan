"""El historial de cambios de una orden (app/api/order/versions.py del API
principal): el backoffice-api le avisa de sus ediciones y le pide el historial."""
from datetime import datetime

import jwt
import pytest
import requests

from app import db
from app.api.orders import _record_order_version as real_record_order_version
from app.models import Order
from tests.test_service_requests import SECRET, FakeResponse, make_user


@pytest.fixture
def order(app):
    order = Order(order_status_id=1, created_date=datetime(2026, 10, 1))
    db.session.add(order)
    db.session.commit()
    return order


@pytest.fixture
def main_api(monkeypatch):
    calls = []
    answer = {'response': FakeResponse(200, {'number': 2})}

    def fake_post(url, json, headers, timeout):
        calls.append({'url': url, 'json': json, 'headers': headers})
        if isinstance(answer['response'], Exception):
            raise answer['response']
        return answer['response']
    monkeypatch.setattr('app.api.orders._record_order_version', real_record_order_version)
    monkeypatch.setattr('app.api.orders.requests.post', fake_post)
    monkeypatch.setenv('INTERNAL_API_URL', 'http://flask-api:8001')
    return calls, answer


def test_a_superadmin_edit_records_the_version_with_who_made_it(client, order, main_api):
    calls, _ = main_api
    headers = make_user('superadmin')
    admin_id = jwt.decode(headers['Authorization'].split()[1], SECRET, algorithms=['HS256'])['id']

    res = client.put(f'/api/orders/{order.id}', json={'comments': '2 sofas'}, headers=headers)

    assert res.status_code == 200
    [call] = calls
    assert call['url'] == f'http://flask-api:8001/api/v1/order/{order.id}/versions'
    assert call['json'] == {'admin_user_id': admin_id}
    token = call['headers']['Authorization'].split()[1]
    assert jwt.decode(token, SECRET, algorithms=['HS256'])['scope'] == 'internal'


@pytest.mark.parametrize('failure', [FakeResponse(500, {}), requests.ConnectionError('down')])
def test_the_edit_is_saved_even_if_the_version_is_not(client, order, main_api, failure):
    _, answer = main_api
    answer['response'] = failure

    res = client.put(f'/api/orders/{order.id}', json={'comments': '2 sofas'},
                     headers=make_user('superadmin'))

    assert res.status_code == 200
    db.session.refresh(order)
    assert order.comments == '2 sofas'


@pytest.fixture
def history(monkeypatch):
    seen = {}
    body = {
        'current_number': 2,
        'versions': [
            {'number': 1, 'author': 'customer', 'admin_user_id': None, 'entries': []},
            {'number': 2, 'author': 'admin', 'admin_user_id': None, 'entries': []},
        ],
        'quotations': [],
    }

    def fake_get(url, headers, timeout):
        seen['url'] = url
        return FakeResponse(200, body)
    monkeypatch.setattr('app.api.orders.requests.get', fake_get)
    monkeypatch.setenv('INTERNAL_API_URL', 'http://flask-api:8001')
    return seen, body


@pytest.mark.parametrize('role', ['admin', 'superadmin'])
def test_admins_read_the_history_with_the_name_of_who_edited(client, order, history, role):
    seen, body = history
    editor = make_user('superadmin', suffix='editor')
    editor_id = jwt.decode(editor['Authorization'].split()[1], SECRET, algorithms=['HS256'])['id']
    body['versions'][1]['admin_user_id'] = editor_id

    res = client.get(f'/api/orders/{order.id}/changes', headers=make_user(role))

    assert res.status_code == 200
    assert seen['url'] == f'http://flask-api:8001/api/v1/order/{order.id}/versions'
    versions = res.get_json()['versions']
    assert versions[0]['admin_name'] is None
    assert versions[1]['admin_name'] == 'superadmin-editor@example.com'


@pytest.mark.parametrize('role', ['carrier_company', 'real_estate_agent'])
def test_others_do_not_read_the_admin_history(client, order, history, role):
    seen, _ = history

    res = client.get(f'/api/orders/{order.id}/changes', headers=make_user(role))

    assert res.status_code == 403
    assert seen == {}
