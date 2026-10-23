import pytest

from app import db
from app.api.carrier_documents import make_token
from app.api.decorators import generate_internal_token
from app.models import CarrierCompany, CarrierDocument, Vehicle


class FakeStorage:
    def __init__(self):
        self.stored = {}   # key -> {'size', 'content_type'}
        self.deleted = []

    def presigned_post(self, key, content_type, max_bytes, expires_in=600):
        return {'url': 'https://bucket.example', 'fields': {'key': key, 'Content-Type': content_type}}

    def presigned_get(self, key, expires_in=3600):
        return f'https://bucket.example/{key}?signature=x'

    def head(self, key):
        return self.stored.get(key)

    def delete(self, key):
        self.deleted.append(key)

    def public_url(self, key):
        return f'https://bucket.example/{key}'


@pytest.fixture
def storage(monkeypatch):
    fake = FakeStorage()
    monkeypatch.setattr('app.api.carrier_documents.get_storage', lambda: fake)
    return fake


@pytest.fixture
def emails(monkeypatch):
    sent = []
    monkeypatch.setattr('app.api.carrier_documents.send_email',
                        lambda to, subject, template, bcc, **kw: sent.append(template))
    return sent


@pytest.fixture
def pending_company(app):
    company = CarrierCompany(name='Juan Perez', active=0)
    db.session.add(company)
    db.session.flush()
    db.session.add(Vehicle(carrier_company_id=company.id, active=0))
    db.session.commit()
    return company


def _upload(client, storage, token, doc_type, content_type='image/jpeg'):
    res = client.post(f'/api/v1/carrier-documents/{token}/presign',
                      json={'doc_type': doc_type, 'content_type': content_type, 'size_bytes': 2048})
    assert res.status_code == 200, res.get_json()
    key = res.get_json()['storage_key']
    storage.stored[key] = {'size': 2048, 'content_type': content_type}
    return client.post(f'/api/v1/carrier-documents/{token}', json={'storage_key': key})


def test_a_bad_or_foreign_token_is_rejected(client, storage):
    res = client.get('/api/v1/carrier-documents/not-a-token')
    assert res.status_code == 401
    assert res.get_json()['reason'] == 'invalid'


def test_presign_puts_the_type_in_a_key_under_the_company(client, storage, pending_company):
    token = make_token(pending_company.id)
    res = client.post(f'/api/v1/carrier-documents/{token}/presign',
                      json={'doc_type': 'identity', 'content_type': 'application/pdf', 'size_bytes': 100})
    key = res.get_json()['storage_key']
    assert key.startswith(f'carrier-documents/{pending_company.id}/identity-')
    assert key.endswith('.pdf')


@pytest.mark.parametrize('body', [
    {'doc_type': 'passport', 'content_type': 'image/jpeg', 'size_bytes': 100},
    {'doc_type': 'identity', 'content_type': 'image/heic', 'size_bytes': 100},
    {'doc_type': 'identity', 'content_type': 'image/jpeg', 'size_bytes': 11 * 1024 * 1024},
    {'doc_type': 'identity', 'content_type': 'image/jpeg', 'size_bytes': True},
])
def test_presign_rejects_bad_files(client, storage, pending_company, body):
    token = make_token(pending_company.id)
    res = client.post(f'/api/v1/carrier-documents/{token}/presign', json=body)
    assert res.status_code == 400


def test_the_vehicle_card_goes_to_the_company_vehicle(client, storage, emails, pending_company):
    token = make_token(pending_company.id)
    res = _upload(client, storage, token, 'vehicle_card')

    assert res.status_code == 201
    vehicle = Vehicle.query.filter_by(carrier_company_id=pending_company.id).first()
    assert res.get_json()['vehicle_id'] == vehicle.id
    assert _upload(client, storage, token, 'identity').get_json()['vehicle_id'] is None


def test_register_rejects_a_key_of_another_company_or_type(client, storage, pending_company):
    other = CarrierCompany(name='Otra', active=0)
    db.session.add(other)
    db.session.commit()
    token = make_token(pending_company.id)
    for key in (f'carrier-documents/{other.id}/identity-abc.jpg',
                f'carrier-documents/{pending_company.id}/passport-abc.jpg',
                f'carrier-documents/{pending_company.id}/../{other.id}/identity-abc.jpg'):
        storage.stored[key] = {'size': 10, 'content_type': 'image/jpeg'}
        res = client.post(f'/api/v1/carrier-documents/{token}', json={'storage_key': key})
        assert res.status_code == 400, key


def test_register_rechecks_what_is_in_the_bucket(client, storage, pending_company):
    token = make_token(pending_company.id)
    key = client.post(f'/api/v1/carrier-documents/{token}/presign',
                      json={'doc_type': 'identity', 'content_type': 'image/jpeg', 'size_bytes': 10}).get_json()['storage_key']

    assert client.post(f'/api/v1/carrier-documents/{token}', json={'storage_key': key}).status_code == 400

    storage.stored[key] = {'size': 10, 'content_type': 'text/html'}
    assert client.post(f'/api/v1/carrier-documents/{token}', json={'storage_key': key}).status_code == 400
    assert key in storage.deleted
    assert CarrierDocument.query.count() == 0


def test_at_most_four_files_per_document(client, storage, emails, pending_company):
    token = make_token(pending_company.id)
    for _ in range(4):
        assert _upload(client, storage, token, 'driver_license').status_code == 201
    res = client.post(f'/api/v1/carrier-documents/{token}/presign',
                      json={'doc_type': 'driver_license', 'content_type': 'image/jpeg', 'size_bytes': 10})
    assert res.status_code == 400


def test_the_team_hears_once_when_the_three_documents_are_in(client, storage, emails, pending_company):
    token = make_token(pending_company.id)
    _upload(client, storage, token, 'identity')
    _upload(client, storage, token, 'identity')
    _upload(client, storage, token, 'driver_license')
    assert emails == []

    _upload(client, storage, token, 'vehicle_card')
    _upload(client, storage, token, 'vehicle_card')
    assert emails == ['email/carrier_documents_complete']


def test_get_lists_the_documents_without_urls(client, storage, emails, pending_company):
    token = make_token(pending_company.id)
    _upload(client, storage, token, 'identity')

    data = client.get(f'/api/v1/carrier-documents/{token}').get_json()
    assert data['company_name'] == 'Juan Perez'
    assert data['can_delete'] is True
    assert [d['doc_type'] for d in data['documents']] == ['identity']
    assert 'url' not in data['documents'][0]


def test_delete_only_while_the_company_waits_for_approval(client, storage, emails, pending_company):
    token = make_token(pending_company.id)
    first = _upload(client, storage, token, 'identity').get_json()['id']
    second = _upload(client, storage, token, 'identity').get_json()['id']

    assert client.delete(f'/api/v1/carrier-documents/{token}/{first}').status_code == 204
    assert db.session.get(CarrierDocument, first) is None

    pending_company.active = 1
    db.session.commit()
    assert client.delete(f'/api/v1/carrier-documents/{token}/{second}').status_code == 409


def test_the_backoffice_gets_signed_urls(client, storage, emails, pending_company):
    _upload(client, storage, make_token(pending_company.id), 'identity')

    url = f'/api/v1/carrier-companies/{pending_company.id}/documents'
    assert client.get(url).status_code == 403
    res = client.get(url, headers={'Authorization': f'Bearer {generate_internal_token()}'})
    assert res.status_code == 200
    assert 'signature=' in res.get_json()['documents'][0]['url']


# Tarjeta por vehículo: el admin sube la de cualquier vehículo desde el
# backoffice (rutas internas); con el link, el transportista sube la del primero.

def _internal():
    return {'Authorization': f'Bearer {generate_internal_token()}'}


def _second_vehicle(company):
    vehicle = Vehicle(carrier_company_id=company.id, active=1, plates='B2C-345')
    db.session.add(vehicle)
    db.session.commit()
    return vehicle


def _upload_card(client, storage, company_id, vehicle_id, content_type='image/jpeg'):
    base = f'/api/v1/carrier-companies/{company_id}/vehicles/{vehicle_id}/card'
    res = client.post(f'{base}/presign', json={'content_type': content_type, 'size_bytes': 2048}, headers=_internal())
    assert res.status_code == 200, res.get_json()
    key = res.get_json()['storage_key']
    storage.stored[key] = {'size': 2048, 'content_type': content_type}
    return client.post(base, json={'storage_key': key}, headers=_internal())


def test_an_admin_uploads_the_card_of_any_vehicle(client, storage, emails, pending_company):
    second = _second_vehicle(pending_company)

    res = _upload_card(client, storage, pending_company.id, second.id)

    assert res.status_code == 201
    assert res.get_json()['vehicle_id'] == second.id
    document = db.session.get(CarrierDocument, res.get_json()['id'])
    assert document.storage_key.startswith(f'carrier-documents/{pending_company.id}/vehicle_card-v{second.id}-')


def test_the_card_routes_are_internal_only(client, storage, pending_company):
    vehicle = Vehicle.query.filter_by(carrier_company_id=pending_company.id).first()
    base = f'/api/v1/carrier-companies/{pending_company.id}/vehicles/{vehicle.id}/card'

    assert client.post(f'{base}/presign', json={'content_type': 'image/jpeg', 'size_bytes': 10}).status_code == 403
    assert client.post(base, json={'storage_key': 'x'}).status_code == 403
    assert client.delete(f'/api/v1/carrier-companies/{pending_company.id}/documents/1').status_code == 403


def test_a_vehicle_of_another_company_is_not_found(client, storage, pending_company):
    other = CarrierCompany(name='Otra', active=1)
    db.session.add(other)
    db.session.commit()
    foreign = _second_vehicle(other)

    res = client.post(f'/api/v1/carrier-companies/{pending_company.id}/vehicles/{foreign.id}/card/presign',
                      json={'content_type': 'image/jpeg', 'size_bytes': 10}, headers=_internal())
    assert res.status_code == 404


def test_the_card_of_one_vehicle_cannot_be_registered_on_another(client, storage, pending_company):
    first = Vehicle.query.filter_by(carrier_company_id=pending_company.id).first()
    second = _second_vehicle(pending_company)
    key = client.post(f'/api/v1/carrier-companies/{pending_company.id}/vehicles/{first.id}/card/presign',
                      json={'content_type': 'image/jpeg', 'size_bytes': 10}, headers=_internal()).get_json()['storage_key']
    storage.stored[key] = {'size': 10, 'content_type': 'image/jpeg'}

    res = client.post(f'/api/v1/carrier-companies/{pending_company.id}/vehicles/{second.id}/card',
                      json={'storage_key': key}, headers=_internal())
    assert res.status_code == 400
    # Ni un DNI subido por el link como tarjeta del vehículo.
    identity = f'carrier-documents/{pending_company.id}/identity-abc.jpg'
    storage.stored[identity] = {'size': 10, 'content_type': 'image/jpeg'}
    res = client.post(f'/api/v1/carrier-companies/{pending_company.id}/vehicles/{second.id}/card',
                      json={'storage_key': identity}, headers=_internal())
    assert res.status_code == 400
    assert CarrierDocument.query.count() == 0


def test_the_four_files_limit_counts_per_vehicle(client, storage, emails, pending_company):
    first = Vehicle.query.filter_by(carrier_company_id=pending_company.id).first()
    second = _second_vehicle(pending_company)
    for _ in range(4):
        assert _upload_card(client, storage, pending_company.id, first.id).status_code == 201

    full = client.post(f'/api/v1/carrier-companies/{pending_company.id}/vehicles/{first.id}/card/presign',
                       json={'content_type': 'image/jpeg', 'size_bytes': 10}, headers=_internal())
    assert full.status_code == 400
    assert _upload_card(client, storage, pending_company.id, second.id).status_code == 201


def test_the_carrier_link_still_uploads_the_first_vehicle_card(client, storage, emails, pending_company):
    first = Vehicle.query.filter_by(carrier_company_id=pending_company.id).first()
    _second_vehicle(pending_company)

    res = _upload(client, storage, make_token(pending_company.id), 'vehicle_card')

    assert res.get_json()['vehicle_id'] == first.id


def test_a_card_key_from_before_goes_to_the_first_vehicle(client, storage, emails, pending_company):
    first = Vehicle.query.filter_by(carrier_company_id=pending_company.id).first()
    key = f'carrier-documents/{pending_company.id}/vehicle_card-abc.jpg'
    storage.stored[key] = {'size': 10, 'content_type': 'image/jpeg'}

    res = client.post(f'/api/v1/carrier-documents/{make_token(pending_company.id)}', json={'storage_key': key})

    assert res.status_code == 201
    assert res.get_json()['vehicle_id'] == first.id


def test_an_admin_upload_does_not_email_the_team(client, storage, emails, pending_company):
    token = make_token(pending_company.id)
    _upload(client, storage, token, 'identity')
    _upload(client, storage, token, 'driver_license')
    vehicle = Vehicle.query.filter_by(carrier_company_id=pending_company.id).first()

    _upload_card(client, storage, pending_company.id, vehicle.id)

    assert emails == []


def test_an_admin_deletes_a_card_of_an_active_company(client, storage, emails, pending_company):
    pending_company.active = 1
    db.session.commit()
    vehicle = Vehicle.query.filter_by(carrier_company_id=pending_company.id).first()
    document_id = _upload_card(client, storage, pending_company.id, vehicle.id).get_json()['id']

    res = client.delete(f'/api/v1/carrier-companies/{pending_company.id}/documents/{document_id}', headers=_internal())

    assert res.status_code == 204
    assert db.session.get(CarrierDocument, document_id) is None
    other = CarrierCompany(name='Otra', active=1)
    db.session.add(other)
    db.session.commit()
    assert client.delete(f'/api/v1/carrier-companies/{other.id}/documents/{document_id}',
                         headers=_internal()).status_code == 404
