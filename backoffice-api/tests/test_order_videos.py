"""Videos de la carga de una orden: el backoffice-api controla el rol y reenvía
al API principal, que firma la subida a S3 y escribe order_videos."""
from datetime import datetime

import jwt
import pytest

from app import db
from app.models import Order, OrderVideo
from tests.test_service_requests import SECRET, FakeResponse, make_user


@pytest.fixture
def forwarded(monkeypatch):
    seen = {}

    def fake_request(method, url, json, headers, timeout):
        seen.update(method=method, url=url, json=json, headers=headers)
        if method == 'DELETE':
            return FakeResponse(204, None)
        return FakeResponse(400, {'message': 'video too large (max 250MB)'})
    monkeypatch.setattr('app.api.orders.requests.request', fake_request)
    monkeypatch.setenv('INTERNAL_API_URL', 'http://flask-api:8001')
    return seen


@pytest.fixture
def order(app):
    order = Order(order_status_id=1, created_date=datetime(2026, 10, 1))
    db.session.add(order)
    db.session.commit()
    return order


@pytest.mark.parametrize('role', ['admin', 'carrier_company'])
def test_only_a_superadmin_uploads_videos(client, order, forwarded, role):
    headers = make_user(role)
    res = client.post(f'/api/orders/{order.id}/videos/presign', headers=headers,
                      json={'content_type': 'video/mp4', 'size_bytes': 100})
    assert res.status_code == 403
    assert forwarded == {}


def test_presign_is_forwarded_with_an_internal_token_and_its_error_kept(client, order, forwarded):
    res = client.post(f'/api/orders/{order.id}/videos/presign', headers=make_user('superadmin'),
                      json={'content_type': 'video/mp4', 'size_bytes': 999})

    assert res.status_code == 400
    assert res.get_json()['message'] == 'video too large (max 250MB)'
    assert forwarded['url'] == f'http://flask-api:8001/api/v1/order/{order.id}/videos/presign'
    assert forwarded['json'] == {'content_type': 'video/mp4', 'size_bytes': 999}
    token = forwarded['headers']['Authorization'].split()[1]
    assert jwt.decode(token, SECRET, algorithms=['HS256'])['scope'] == 'internal'


def test_delete_is_forwarded(client, order, forwarded):
    res = client.delete(f'/api/orders/{order.id}/videos/7', headers=make_user('superadmin'))

    assert res.status_code == 204
    assert forwarded['method'] == 'DELETE'
    assert forwarded['url'].endswith(f'/api/v1/order/{order.id}/videos/7')


def test_the_admin_detail_lists_the_videos(client, order):
    db.session.add(OrderVideo(order_id=order.id, url='https://bucket.example/orders/1/video-a.mp4',
                              storage_key='orders/1/video-a.mp4', content_type='video/mp4', size_bytes=10))
    db.session.commit()

    admin_view = client.get(f'/api/orders/{order.id}', headers=make_user('admin')).get_json()['order']

    assert [v['url'] for v in admin_view['videos']] == ['https://bucket.example/orders/1/video-a.mp4']
