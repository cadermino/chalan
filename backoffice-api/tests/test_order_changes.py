"""El historial de cambios de una orden (app/api/order/versions.py del API
principal): el backoffice-api le avisa de sus ediciones y le pide el historial."""
from datetime import datetime

import jwt
import pytest
import requests

from app import db
from app.api.orders import _record_order_version as real_record_order_version
from app.models import Order, OrderVersion, Quotation
from tests.test_carrier_declines import carrier, carrier_user, make_order  # noqa: F401
from tests.test_service_requests import SECRET, FakeResponse, make_carrier, make_user


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


def test_a_real_estate_agent_reads_no_changes(client, order, history):
    seen, _ = history

    res = client.get(f'/api/orders/{order.id}/changes', headers=make_user('real_estate_agent'))

    assert res.status_code == 403
    assert seen == {}


# --- La empresa -------------------------------------------------------------------

@pytest.fixture
def carrier_main_api(monkeypatch):
    seen = []
    changes = {'since': 'sent', 'entries': [{'field': 'comments'}], 'history': []}

    def fake_get(url, params, headers, timeout):
        seen.append({'url': url, 'params': params})
        return FakeResponse(200, {'changes': changes})
    monkeypatch.setattr('app.api.orders.requests.get', fake_get)
    monkeypatch.setenv('INTERNAL_API_URL', 'http://flask-api:8001')
    return seen, changes


def test_a_carrier_gets_the_district_only_changes_before_the_move_is_theirs(client, carrier, carrier_user,
                                                                             carrier_main_api):
    seen, changes = carrier_main_api
    order = make_order()

    res = client.get(f'/api/orders/{order.id}/changes', headers=carrier_user)

    assert res.status_code == 200
    assert res.get_json() == {'changes': changes}
    assert seen == [{'url': f'http://flask-api:8001/api/v1/order/{order.id}/changes',
                     'params': {'carrier_company_id': carrier.id, 'address': 'district'}}]


def test_a_carrier_gets_the_full_address_once_the_move_is_theirs(client, carrier, carrier_user, carrier_main_api):
    seen, _ = carrier_main_api
    order = make_order(2)
    db.session.add(Quotation(order_id=order.id, carrier_company_id=carrier.id, amount=320, quotation_status_id=2))
    db.session.commit()

    client.get(f'/api/orders/{order.id}/changes', headers=carrier_user)

    assert seen[0]['params'] == {'carrier_company_id': carrier.id, 'address': 'full'}


def test_a_carrier_that_can_no_longer_quote_gets_no_changes(client, carrier, carrier_user, carrier_main_api):
    seen, _ = carrier_main_api
    other = make_carrier(name='Otra SAC')
    order = make_order(2)
    db.session.add(Quotation(order_id=order.id, carrier_company_id=other.id, amount=300, quotation_status_id=2))
    db.session.commit()

    res = client.get(f'/api/orders/{order.id}/changes', headers=carrier_user)

    assert res.get_json() == {'changes': None}
    assert seen == []


def test_a_carrier_cannot_ask_for_another_companys_changes(client, carrier, carrier_user, carrier_main_api):
    seen, _ = carrier_main_api
    other = make_carrier(name='Otra SAC')
    order = make_order()

    client.get(f'/api/orders/{order.id}/changes?carrier_company_id={other.id}', headers=carrier_user)

    assert seen[0]['params']['carrier_company_id'] == carrier.id


def _version(order, number):
    version = OrderVersion(order_id=order.id, number=number, author='customer', snapshot={})
    db.session.add(version)
    db.session.commit()
    return version


def _quote(order, company, version=None, status=1, updated=datetime(2026, 10, 2)):
    db.session.add(Quotation(order_id=order.id, carrier_company_id=company.id, amount=300,
                             quotation_status_id=status, updated_date=updated,
                             order_version_id=version.id if version else None))
    db.session.commit()


def test_the_list_marks_the_orders_that_changed_since_the_carrier_read_them(client, carrier, carrier_user):
    never_sent, unchanged, changed, quoted_before, requoted, cancelled = (make_order() for _ in range(6))
    _version(unchanged, 1)
    for order in (changed, quoted_before, requoted, cancelled):
        _version(order, 1)
    _version(changed, 2)                       # no cotizó: se compara con la 1
    v1 = OrderVersion.query.filter_by(order_id=quoted_before.id).one()
    _quote(quoted_before, carrier, v1)
    _version(quoted_before, 2)                 # cotizó sobre la 1 y cambió
    _version(requoted, 2)
    _quote(requoted, carrier, OrderVersion.query.filter_by(order_id=requoted.id, number=2).one())
    _quote(cancelled, carrier, OrderVersion.query.filter_by(order_id=cancelled.id, number=1).one(), status=3)
    _version(cancelled, 2)                     # su cotización se canceló con el cambio

    orders = client.get('/api/orders/pending', headers=carrier_user).get_json()['orders']

    marked = {o['id'] for o in orders if o['changed']}
    assert marked == {changed.id, quoted_before.id, cancelled.id}
    assert never_sent.id not in marked and unchanged.id not in marked and requoted.id not in marked


def test_admins_get_no_changed_mark(client, order):
    _version(order, 1)
    _version(order, 2)

    orders = client.get('/api/orders/pending', headers=make_user('admin')).get_json()['orders']

    assert [o['changed'] for o in orders] == [False]
