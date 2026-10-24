"""La foto de cada vehículo (vehicles.picture) y lo que ve el cliente en la
página pública del transportista."""
from decimal import Decimal

import pytest

from app import db
from app.api.decorators import generate_internal_token
from app.models import CarrierCompany, Vehicle
from tests.test_order_videos import FakeStorage


@pytest.fixture
def storage(monkeypatch):
    fake = FakeStorage()
    monkeypatch.setattr('app.api.vehicle_photos.get_storage', lambda: fake)
    return fake


@pytest.fixture
def internal():
    return {'Authorization': f'Bearer {generate_internal_token()}'}


@pytest.fixture
def vehicle(app):
    company = CarrierCompany(name='Mudanzas SAC', active=1)
    db.session.add(company)
    db.session.commit()
    vehicle = Vehicle(carrier_company_id=company.id, active=1, brand='Hyundai', model='HD65')
    db.session.add(vehicle)
    db.session.commit()
    return vehicle


def _base(vehicle):
    return f'/api/v1/carrier-companies/{vehicle.carrier_company_id}/vehicles/{vehicle.id}/photo'


def _upload(client, storage, internal, vehicle, content_type='image/jpeg', size=2 * 1024 * 1024):
    res = client.post(f'{_base(vehicle)}/presign', headers=internal,
                      json={'content_type': content_type, 'size_bytes': size})
    assert res.status_code == 200, res.get_json()
    key = res.get_json()['storage_key']
    storage.stored[key] = {'size': size, 'content_type': content_type}
    return key, client.post(_base(vehicle), headers=internal, json={'storage_key': key})


def test_only_the_backoffice_can_upload(client, storage, vehicle):
    assert client.post(f'{_base(vehicle)}/presign',
                       json={'content_type': 'image/jpeg', 'size_bytes': 100}).status_code == 403
    assert client.post(_base(vehicle), json={'storage_key': 'x'}).status_code == 403
    assert client.delete(_base(vehicle)).status_code == 403


def test_a_vehicle_of_another_company_is_not_found(client, storage, internal, vehicle):
    url = f'/api/v1/carrier-companies/{vehicle.carrier_company_id + 1}/vehicles/{vehicle.id}/photo/presign'
    res = client.post(url, headers=internal, json={'content_type': 'image/jpeg', 'size_bytes': 100})
    assert res.status_code == 404


@pytest.mark.parametrize('body', [
    {'content_type': 'application/pdf', 'size_bytes': 100},
    {'content_type': 'image/jpeg', 'size_bytes': 11 * 1024 * 1024},
    {'content_type': 'image/jpeg', 'size_bytes': 0},
])
def test_presign_rejects_bad_files(client, storage, internal, vehicle, body):
    assert client.post(f'{_base(vehicle)}/presign', headers=internal, json=body).status_code == 400


def test_the_photo_becomes_the_vehicle_picture(client, storage, internal, vehicle):
    key, res = _upload(client, storage, internal, vehicle, content_type='image/webp')

    assert key.startswith(f'vehicles/{vehicle.id}/photo-') and key.endswith('.webp')
    assert res.status_code == 201
    assert res.get_json()['picture'] == f'https://bucket.example/{key}'
    assert db.session.get(Vehicle, vehicle.id).picture == f'https://bucket.example/{key}'


def test_a_new_photo_replaces_and_deletes_the_old_one(client, storage, internal, vehicle):
    first, _ = _upload(client, storage, internal, vehicle)
    second, res = _upload(client, storage, internal, vehicle)

    assert res.status_code == 201
    assert db.session.get(Vehicle, vehicle.id).picture.endswith(second)
    assert storage.deleted == [first]


def test_a_hand_typed_url_is_replaced_but_not_deleted(client, storage, internal, vehicle):
    vehicle.picture = 'https://example.com/camion.jpg'
    db.session.commit()

    _upload(client, storage, internal, vehicle)

    assert storage.deleted == []


def test_register_rejects_a_key_of_another_vehicle(client, storage, internal, vehicle):
    for key in [f'vehicles/{vehicle.id + 1}/photo-abc.jpg', f'vehicles/{vehicle.id}/photo-../x.jpg',
                f'orders/1/photo-abc.jpg']:
        res = client.post(_base(vehicle), headers=internal, json={'storage_key': key})
        assert res.status_code == 400


def test_register_rechecks_what_is_in_the_bucket(client, storage, internal, vehicle):
    res = client.post(f'{_base(vehicle)}/presign', headers=internal,
                      json={'content_type': 'image/jpeg', 'size_bytes': 100})
    key = res.get_json()['storage_key']

    assert client.post(_base(vehicle), headers=internal, json={'storage_key': key}).status_code == 400

    storage.stored[key] = {'size': 100, 'content_type': 'text/html'}
    assert client.post(_base(vehicle), headers=internal, json={'storage_key': key}).status_code == 400
    assert storage.deleted == [key]
    assert db.session.get(Vehicle, vehicle.id).picture is None


def test_delete_clears_the_picture_and_the_file(client, storage, internal, vehicle):
    key, _ = _upload(client, storage, internal, vehicle)

    assert client.delete(_base(vehicle), headers=internal).status_code == 204
    assert db.session.get(Vehicle, vehicle.id).picture is None
    assert storage.deleted == [key]


def test_the_public_page_lists_active_vehicles_without_plates(client, vehicle):
    vehicle.picture = 'https://bucket.example/vehicles/1/photo-a.jpg'
    vehicle.plates = 'ABC-123'
    vehicle.cargo_cover = 'cerrada'
    vehicle.payload_tons = Decimal('2.500')
    db.session.add(Vehicle(carrier_company_id=vehicle.carrier_company_id, active=0, brand='Vendido'))
    db.session.commit()

    res = client.get(f'/api/v1/carrier-company/{vehicle.carrier_company_id}')

    vehicles = res.get_json()['vehicles']
    assert [v['brand'] for v in vehicles] == ['Hyundai']
    assert vehicles[0]['picture'] == 'https://bucket.example/vehicles/1/photo-a.jpg'
    assert vehicles[0]['cargo_cover'] == 'cerrada'
    assert vehicles[0]['payload_tons'] == 2.5
    assert 'plates' not in vehicles[0]
