"""La foto del vehículo: el backoffice-api revisa que quien la sube puede tocar
esa empresa y reenvía al API principal, dueño de S3."""
import pytest

from app import db
from app.models import CarrierCompany, Vehicle
from tests.test_service_requests import FakeResponse, make_user


@pytest.fixture
def forwarded(monkeypatch):
    seen = {}

    def fake_request(method, url, json, headers, timeout):
        seen.update(method=method, url=url, json=json, headers=headers)
        if method == 'DELETE':
            return FakeResponse(204, None)
        return FakeResponse(201, {'picture': 'https://bucket.example/vehicles/1/photo-a.jpg'})
    monkeypatch.setattr('app.api.vehicles.requests.request', fake_request)
    monkeypatch.setenv('INTERNAL_API_URL', 'http://flask-api:8001')
    return seen


@pytest.fixture
def vehicle(app):
    company = CarrierCompany(name='Mudanzas SAC', active=1, rfc='')
    db.session.add(company)
    db.session.commit()
    vehicle = Vehicle(carrier_company_id=company.id, active=1)
    db.session.add(vehicle)
    db.session.commit()
    return vehicle


def _url(vehicle, company_id=None):
    return f'/api/carrier-companies/{company_id or vehicle.carrier_company_id}/vehicles/{vehicle.id}/photo'


def test_the_company_uploads_the_photo_of_its_own_vehicle(client, forwarded, vehicle):
    headers = make_user('carrier_company', carrier_company_id=vehicle.carrier_company_id)

    res = client.post(_url(vehicle), headers=headers, json={'storage_key': 'vehicles/1/photo-a.jpg'})

    assert res.status_code == 201
    assert forwarded['url'] == (f'http://flask-api:8001/api/v1/carrier-companies/'
                                f'{vehicle.carrier_company_id}/vehicles/{vehicle.id}/photo')
    assert forwarded['json'] == {'storage_key': 'vehicles/1/photo-a.jpg'}
    assert forwarded['headers']['Authorization'].startswith('Bearer ')


def test_another_company_cannot_touch_the_photo(client, forwarded, vehicle):
    headers = make_user('carrier_company', carrier_company_id=vehicle.carrier_company_id + 1)

    res = client.post(f'{_url(vehicle)}/presign', headers=headers,
                      json={'content_type': 'image/jpeg', 'size_bytes': 100})

    assert res.status_code == 403
    assert forwarded == {}


def test_a_vehicle_of_another_company_is_not_found(client, forwarded, vehicle):
    headers = make_user('admin')
    other = CarrierCompany(name='Otra', active=1, rfc='')
    db.session.add(other)
    db.session.commit()

    res = client.delete(_url(vehicle, company_id=other.id), headers=headers)

    assert res.status_code == 404
    assert forwarded == {}


def test_admins_presign_and_delete(client, forwarded, vehicle):
    headers = make_user('admin')

    res = client.post(f'{_url(vehicle)}/presign', headers=headers,
                      json={'content_type': 'image/jpeg', 'size_bytes': 100})
    assert res.status_code == 201
    assert forwarded['url'].endswith('/photo/presign')

    assert client.delete(_url(vehicle), headers=headers).status_code == 204
    assert forwarded['method'] == 'DELETE'
