import pytest

from app.api.carrier_company import CarrierCompany as CarrierCompanyEntity
from app.api.decorators import generate_internal_token
from app.models import OrderVideo


class FakeStorage:
    def __init__(self):
        self.stored = {}   # key -> {'size', 'content_type'}
        self.deleted = []

    def presigned_post(self, key, content_type, max_bytes, expires_in=600):
        return {'url': 'https://bucket.example', 'fields': {'key': key, 'Content-Type': content_type}}

    def head(self, key):
        return self.stored.get(key)

    def delete(self, key):
        self.deleted.append(key)

    def public_url(self, key):
        return f'https://bucket.example/{key}'


@pytest.fixture
def storage(monkeypatch):
    fake = FakeStorage()
    monkeypatch.setattr('app.api.order_videos.get_storage', lambda: fake)
    return fake


@pytest.fixture
def internal():
    return {'Authorization': f'Bearer {generate_internal_token()}'}


def _upload(client, storage, internal, order_id, content_type='video/mp4', size=50 * 1024 * 1024):
    res = client.post(f'/api/v1/order/{order_id}/videos/presign', headers=internal,
                      json={'content_type': content_type, 'size_bytes': size})
    assert res.status_code == 200, res.get_json()
    key = res.get_json()['storage_key']
    storage.stored[key] = {'size': size, 'content_type': content_type}
    return client.post(f'/api/v1/order/{order_id}/videos', headers=internal, json={'storage_key': key})


def test_only_the_backoffice_can_upload(client, storage, order):
    res = client.post(f'/api/v1/order/{order.id}/videos/presign',
                      json={'content_type': 'video/mp4', 'size_bytes': 100})
    assert res.status_code == 403
    assert client.delete(f'/api/v1/order/{order.id}/videos/1').status_code == 403


def test_presign_puts_the_video_under_the_order(client, storage, internal, order):
    res = client.post(f'/api/v1/order/{order.id}/videos/presign', headers=internal,
                      json={'content_type': 'video/quicktime', 'size_bytes': 100})
    key = res.get_json()['storage_key']
    assert key.startswith(f'orders/{order.id}/video-')
    assert key.endswith('.mov')


@pytest.mark.parametrize('body', [
    {'content_type': 'image/jpeg', 'size_bytes': 100},
    {'content_type': 'video/mp4', 'size_bytes': 251 * 1024 * 1024},
    {'content_type': 'video/mp4', 'size_bytes': True},
    {'content_type': 'video/mp4'},
])
def test_presign_rejects_bad_files(client, storage, internal, order, body):
    res = client.post(f'/api/v1/order/{order.id}/videos/presign', headers=internal, json=body)
    assert res.status_code == 400


def test_register_rejects_a_key_of_another_order(client, storage, internal, order):
    for key in (f'orders/{order.id + 1}/video-abc.mp4',
                f'orders/{order.id}/abc.mp4',
                f'orders/{order.id}/video-../x.mp4'):
        storage.stored[key] = {'size': 10, 'content_type': 'video/mp4'}
        res = client.post(f'/api/v1/order/{order.id}/videos', headers=internal, json={'storage_key': key})
        assert res.status_code == 400, key


def test_register_rechecks_what_is_in_the_bucket(client, storage, internal, order):
    key = client.post(f'/api/v1/order/{order.id}/videos/presign', headers=internal,
                      json={'content_type': 'video/mp4', 'size_bytes': 10}).get_json()['storage_key']
    assert client.post(f'/api/v1/order/{order.id}/videos', headers=internal,
                       json={'storage_key': key}).status_code == 400

    storage.stored[key] = {'size': 10, 'content_type': 'text/html'}
    res = client.post(f'/api/v1/order/{order.id}/videos', headers=internal, json={'storage_key': key})
    assert res.status_code == 400
    assert storage.deleted == [key]


def test_registering_twice_keeps_one_row(client, storage, internal, order):
    res = _upload(client, storage, internal, order.id)
    assert res.status_code == 201
    again = client.post(f'/api/v1/order/{order.id}/videos', headers=internal,
                        json={'storage_key': OrderVideo.query.one().storage_key})
    assert again.status_code == 200
    assert OrderVideo.query.count() == 1


def test_at_most_five_videos(client, storage, internal, order):
    for _ in range(5):
        assert _upload(client, storage, internal, order.id).status_code == 201
    res = client.post(f'/api/v1/order/{order.id}/videos/presign', headers=internal,
                      json={'content_type': 'video/mp4', 'size_bytes': 100})
    assert res.status_code == 400


def test_the_carrier_link_shows_the_videos(client, storage, internal, order, carrier_company):
    video = _upload(client, storage, internal, order.id).get_json()
    token = CarrierCompanyEntity().generate_carrier_company_token(3600, order.id, carrier_company.id)

    res = client.get('/api/v1/orders/details', headers={'Authorization': f'Bearer {token}'})

    videos = res.get_json()['order']['videos']
    assert [v['url'] for v in videos] == [video['url']]
    assert videos[0]['content_type'] == 'video/mp4'


def test_delete_removes_the_file_and_the_row(client, storage, internal, order):
    video = _upload(client, storage, internal, order.id).get_json()

    res = client.delete(f'/api/v1/order/{order.id}/videos/{video["id"]}', headers=internal)

    assert res.status_code == 204
    assert OrderVideo.query.count() == 0
    assert storage.deleted and storage.deleted[0].startswith(f'orders/{order.id}/video-')
