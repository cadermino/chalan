from datetime import datetime

import jwt
import pytest

from app import db
from app.api.decorators import generate_internal_token
from app.api.service_request.validation import LIMA
from app.models import (CarrierCompany, CarrierCompanyServiceType, ServiceMaterial,
                        ServiceRequest, ServiceRequestMedia, ServiceRequestNotification,
                        ServiceRequestCarrierDecline, ServiceRequestQuotation, ServiceType)

ADDRESS = {
    'street': 'Av. Javier Prado Este 123, San Isidro',
    'interior': 'Dpto 402',
    'neighborhood': 'San Isidro',
    'city': 'Lima',
    'state': 'Lima',
    'country': 'PE',
    'map_url': 'https://maps.google.com/?cid=1',
}
TOMORROW = '2026-10-06'


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


@pytest.fixture(autouse=True)
def lima_clock(monkeypatch):
    """23:30 of Oct 5 in Lima, which is already Oct 6 in UTC."""
    monkeypatch.setattr('app.api.service_request.validation.now_lima',
                        lambda: datetime(2026, 10, 5, 23, 30, tzinfo=LIMA))


@pytest.fixture(autouse=True)
def sent(monkeypatch):
    calls = {'email': [], 'whatsapp': []}
    monkeypatch.setattr('app.api.service_request.notifications.send_email',
                        lambda to, subject, template, bcc, **kw: calls['email'].append(
                            {'to': to, 'subject': subject, 'template': template, **kw}))
    monkeypatch.setattr('app.api.service_request.notifications.send_whatsapp',
                        lambda phone, sid, variables, **kw: calls['whatsapp'].append(
                            {'phone': phone, 'variables': variables}))
    monkeypatch.setenv('SITE_URL', 'https://chalan.pe')
    # The request takes its country from the environment; do not depend on the host's.
    monkeypatch.setenv('PLATFORM_FEE', '0.1')
    monkeypatch.setenv('COUNTRY_ID', '2')
    monkeypatch.delenv('NOTIFY_EMAIL', raising=False)
    monkeypatch.delenv('NOTIFY_WHATSAPP_PHONE', raising=False)
    return calls


@pytest.fixture
def storage(monkeypatch):
    fake = FakeStorage()
    monkeypatch.setattr('app.api.service_requests.get_storage', lambda: fake)
    return fake


@pytest.fixture(autouse=True)
def catalog(app):
    packing = ServiceType(code='packing', name='Embalaje')
    cleaning = ServiceType(code='cleaning', name='Limpieza')
    db.session.add_all([packing, cleaning])
    db.session.commit()
    db.session.add_all([
        ServiceMaterial(service_type_id=packing.id, code='stretch_film', name='Film', position=2),
        ServiceMaterial(service_type_id=packing.id, code='cardboard_sheet', name='Cartón', position=1),
        ServiceMaterial(service_type_id=packing.id, code='carpet', name='Alfombra', position=3),
        ServiceMaterial(service_type_id=packing.id, code='wooden_crate', name='Caja de madera',
                        position=4, active=0),
        ServiceMaterial(service_type_id=cleaning.id, code='mop', name='Trapeador', position=1),
    ])
    db.session.commit()
    return packing


def create_draft(client, **overrides):
    body = {'service_type': 'packing', 'address': ADDRESS, **overrides}
    response = client.post('/api/v1/service-requests', json=body)
    assert response.status_code == 201, response.get_json()
    return response.get_json()['public_id']


def fill(client, public_id, items=None, preferred_date=TOMORROW):
    body = {'items': items if items is not None else [
        {'description': 'Sofá', 'quantity': 1, 'materials': ['stretch_film', 'carpet']}]}
    if preferred_date:
        body['preferred_date'] = preferred_date
    response = client.patch(f'/api/v1/service-requests/{public_id}', json=body)
    assert response.status_code == 200, response.get_json()
    return response


def submit(client, public_id, **body):
    body.setdefault('whatsapp', '987654321')
    return client.post(f'/api/v1/service-requests/{public_id}/submit', json=body)


def make_carrier(name='Embala SAC', packing=True, **kwargs):
    kwargs.setdefault('active', 1)
    kwargs.setdefault('country_id', 2)
    kwargs.setdefault('email', f'{name.split()[0].lower()}@example.com')
    kwargs.setdefault('phone', '999111222')
    carrier = CarrierCompany(name=name, **kwargs)
    db.session.add(carrier)
    db.session.commit()
    if packing:
        packing_type = ServiceType.query.filter_by(code='packing').first()
        db.session.add(CarrierCompanyServiceType(
            carrier_company_id=carrier.id, service_type_id=packing_type.id))
        db.session.commit()
    return carrier


def internal_headers():
    return {'Authorization': f'Bearer {generate_internal_token()}'}


# --- catalog ---------------------------------------------------------------

def test_materials_endpoint_skips_inactive_and_respects_position(client):
    response = client.get('/api/v1/service-types/packing/materials')

    assert response.status_code == 200
    assert [m['code'] for m in response.get_json()] == ['cardboard_sheet', 'stretch_film', 'carpet']


def test_materials_endpoint_for_unknown_service_is_404(client):
    assert client.get('/api/v1/service-types/nope/materials').status_code == 404


# --- creating and editing a draft -------------------------------------------

def test_create_without_map_url_is_rejected(client):
    address = {**ADDRESS, 'map_url': ''}
    response = client.post('/api/v1/service-requests', json={'service_type': 'packing', 'address': address})

    assert response.status_code == 400
    assert 'map_url' in response.get_json()['message']
    assert ServiceRequest.query.count() == 0


def test_create_with_full_address_returns_public_id(client):
    public_id = create_draft(client)

    assert len(public_id) == 32
    saved = ServiceRequest.query.filter_by(public_id=public_id).one()
    assert saved.status == 'draft'
    assert saved.neighborhood == 'San Isidro'


def test_create_with_unknown_service_type_is_rejected(client):
    # 'cleaning' is in the catalog but nothing knows how to validate it yet.
    response = client.post('/api/v1/service-requests', json={'service_type': 'cleaning', 'address': ADDRESS})

    assert response.status_code == 400


def test_honeypot_answers_201_and_stores_nothing(client):
    response = client.post('/api/v1/service-requests',
                           json={'service_type': 'packing', 'address': ADDRESS, 'website': 'http://spam'})

    assert response.status_code == 201
    assert len(response.get_json()['public_id']) == 32
    assert ServiceRequest.query.count() == 0


def test_patch_replaces_items_with_their_materials(client):
    public_id = create_draft(client)
    fill(client, public_id)

    response = fill(client, public_id, items=[
        {'description': 'Vajilla', 'quantity': 3, 'materials': ['cardboard_sheet']},
        {'description': 'TV', 'quantity': 1, 'materials': []},
    ])

    items = response.get_json()['items']
    assert [(i['description'], i['quantity'], i['materials']) for i in items] == [
        ('Vajilla', 3, ['cardboard_sheet']), ('TV', 1, [])]
    assert len(ServiceRequest.query.one().items) == 2


@pytest.mark.parametrize('materials', [['unknown'], ['wooden_crate'], ['mop']])
def test_material_that_is_missing_inactive_or_of_another_service_is_rejected(client, materials):
    public_id = create_draft(client)

    response = client.patch(f'/api/v1/service-requests/{public_id}', json={
        'items': [{'description': 'Sofá', 'quantity': 1, 'materials': materials}]})

    assert response.status_code == 400
    assert materials[0] in response.get_json()['message']


def test_empty_materials_list_is_valid(client):
    public_id = create_draft(client)

    fill(client, public_id, items=[{'description': 'Sofá', 'quantity': 1, 'materials': []}])


def test_duplicate_material_codes_are_deduplicated(client):
    public_id = create_draft(client)

    response = fill(client, public_id, items=[
        {'description': 'Sofá', 'quantity': 1, 'materials': ['carpet', 'carpet']}])

    assert response.get_json()['items'][0]['materials'] == ['carpet']


@pytest.mark.parametrize('item', [
    {'description': '', 'quantity': 1},
    {'description': 'x' * 201, 'quantity': 1},
    {'description': 'Sofá', 'quantity': 0},
    {'description': 'Sofá', 'quantity': 1000},
    {'description': 'Sofá', 'quantity': 'dos'},
])
def test_invalid_items_are_rejected(client, item):
    public_id = create_draft(client)

    response = client.patch(f'/api/v1/service-requests/{public_id}', json={'items': [item]})

    assert response.status_code == 400


def test_more_than_fifty_items_are_rejected(client):
    public_id = create_draft(client)

    response = client.patch(f'/api/v1/service-requests/{public_id}', json={
        'items': [{'description': f'Cosa {n}', 'quantity': 1} for n in range(51)]})

    assert response.status_code == 400


def test_a_failed_patch_writes_nothing(client):
    public_id = create_draft(client)
    fill(client, public_id)

    response = client.patch(f'/api/v1/service-requests/{public_id}', json={
        'preferred_date': '2026-10-07',
        'items': [{'description': 'Mesa', 'quantity': 1, 'materials': ['unknown']}]})

    assert response.status_code == 400
    saved = ServiceRequest.query.one()
    assert saved.preferred_date.isoformat() == TOMORROW
    assert [i.description for i in saved.items] == ['Sofá']


def test_get_returns_the_draft_to_resume(client):
    public_id = create_draft(client)
    fill(client, public_id)

    data = client.get(f'/api/v1/service-requests/{public_id}').get_json()

    assert data['status'] == 'draft'
    assert data['address']['street'] == ADDRESS['street']
    assert data['preferred_date'] == TOMORROW
    assert data['items'][0]['materials'] == ['stretch_film', 'carpet']


def test_unknown_public_id_is_404(client):
    assert client.get('/api/v1/service-requests/' + 'f' * 32).status_code == 404
    assert client.patch('/api/v1/service-requests/' + 'f' * 32, json={}).status_code == 404


# --- preferred date ----------------------------------------------------------

def test_tomorrow_in_lima_is_accepted_even_though_utc_is_already_tomorrow(client):
    public_id = create_draft(client)

    fill(client, public_id, preferred_date='2026-10-06')


@pytest.mark.parametrize('value', [
    '2026-10-05',      # today in Lima: not allowed
    '2026-10-04',      # past
    '2027-01-04',      # 91 days ahead
    '2026-13-45',      # impossible
    '18/10/2026',      # wrong format
    '',
    None,
])
def test_invalid_preferred_date_is_rejected(client, value):
    public_id = create_draft(client)

    response = client.patch(f'/api/v1/service-requests/{public_id}', json={'preferred_date': value})

    assert response.status_code == 400


def test_preferred_date_ninety_days_ahead_is_the_last_valid_day(client):
    public_id = create_draft(client)

    fill(client, public_id, preferred_date='2027-01-03')


# --- submit -------------------------------------------------------------------

def test_submit_stores_whatsapp_in_e164_and_marks_it_submitted(client):
    public_id = create_draft(client)
    fill(client, public_id)

    response = submit(client, public_id, whatsapp='987 654 321')

    assert response.status_code == 200
    saved = ServiceRequest.query.one()
    assert saved.status == 'submitted'
    assert saved.whatsapp == '+51987654321'
    assert saved.submitted_at is not None


@pytest.mark.parametrize('whatsapp', ['12345', 'hola', '', None])
def test_submit_with_invalid_whatsapp_is_rejected(client, whatsapp):
    public_id = create_draft(client)
    fill(client, public_id)

    response = submit(client, public_id, whatsapp=whatsapp)

    assert response.status_code == 400
    assert ServiceRequest.query.one().status == 'draft'


def test_submit_without_items_is_rejected(client):
    public_id = create_draft(client)
    client.patch(f'/api/v1/service-requests/{public_id}', json={'preferred_date': TOMORROW})

    assert submit(client, public_id).status_code == 400


def test_submit_without_a_date_is_rejected(client):
    public_id = create_draft(client)
    fill(client, public_id, preferred_date=None)

    assert submit(client, public_id).status_code == 400


def test_submit_can_carry_the_date(client):
    public_id = create_draft(client)
    fill(client, public_id, preferred_date=None)

    assert submit(client, public_id, preferred_date='2026-10-20').status_code == 200
    assert ServiceRequest.query.one().preferred_date.isoformat() == '2026-10-20'


def test_submit_revalidates_a_saved_date_that_has_since_passed(client, monkeypatch):
    public_id = create_draft(client)
    fill(client, public_id)
    monkeypatch.setattr('app.api.service_request.validation.now_lima',
                        lambda: datetime(2026, 10, 10, 9, 0, tzinfo=LIMA))

    response = submit(client, public_id)

    assert response.status_code == 400
    assert ServiceRequest.query.one().status == 'draft'


def test_a_submitted_request_can_no_longer_be_edited(client):
    public_id = create_draft(client)
    fill(client, public_id)
    submit(client, public_id)

    response = client.patch(f'/api/v1/service-requests/{public_id}', json={'items': []})

    assert response.status_code == 409


def test_submitting_twice_does_not_notify_again(client, sent):
    make_carrier()
    public_id = create_draft(client)
    fill(client, public_id)
    submit(client, public_id)
    emails, whatsapps = len(sent['email']), len(sent['whatsapp'])
    assert emails == 1 and whatsapps >= 1

    second = submit(client, public_id)

    assert second.status_code == 200
    assert (len(sent['email']), len(sent['whatsapp'])) == (emails, whatsapps)


# --- notifications --------------------------------------------------------------

def test_only_active_carriers_offering_the_service_are_notified(client, sent):
    offers = make_carrier('Embala SAC')
    make_carrier('Dormido SAC', active=0)
    make_carrier('Soloflete SAC', packing=False)
    public_id = create_draft(client)
    fill(client, public_id)

    submit(client, public_id)

    assert [e['to'] for e in sent['email']] == ['embala@example.com']
    notified = ServiceRequestNotification.query.all()
    assert [n.carrier_company_id for n in notified] == [offers.id]


def test_a_carrier_from_another_country_is_not_notified(client, sent):
    make_carrier('Mexicana SAC', country_id=1)
    public_id = create_draft(client)
    fill(client, public_id)

    submit(client, public_id)

    assert sent['email'] == []
    assert ServiceRequestNotification.query.count() == 0


def test_carrier_link_holds_a_service_request_token_and_the_key_facts(client, sent):
    carrier = make_carrier()
    public_id = create_draft(client)
    fill(client, public_id)
    submit(client, public_id)

    email = sent['email'][0]
    url = email['request_url']
    assert url.startswith('https://chalan.pe/backoffice/carrier-view/')
    assert email['template'] == 'email/ask_for_service_quotation'
    assert email['neighborhood'] == 'San Isidro'
    assert email['preferred_date'] == '06/10/2026'
    token = url.rsplit('/', 1)[1]
    payload = jwt.decode(token, 'test-secret-key-at-least-32-bytes-long', algorithms=['HS256'])
    assert payload['purpose'] == 'service_request'
    assert payload['carrier_company_id'] == carrier.id
    assert payload['service_request_id'] == ServiceRequest.query.one().id
    assert sent['whatsapp'][0]['variables'] == {'1': 'embalaje', '2': url}


def test_admin_is_told_even_when_no_carrier_offers_the_service(client, sent, monkeypatch):
    monkeypatch.setenv('NOTIFY_EMAIL', 'admin@example.com')
    monkeypatch.setenv('NOTIFY_WHATSAPP_PHONE', '999000111')
    public_id = create_draft(client)
    fill(client, public_id)

    submit(client, public_id)

    admin_email = sent['email'][0]
    assert admin_email['to'] == 'admin@example.com'
    assert admin_email['template'] == 'email/service_request_admin'
    assert admin_email['carriers'] == []
    assert admin_email['whatsapp'] == '+51987654321'
    assert admin_email['admin_url'] == f'https://chalan.pe/backoffice/service-requests/{ServiceRequest.query.one().id}'
    assert sent['whatsapp'][0]['phone'] == '999000111'


def test_a_carrier_without_email_or_phone_is_skipped_and_not_recorded(client, sent):
    make_carrier('Fantasma SAC', email=None, phone=None)
    public_id = create_draft(client)
    fill(client, public_id)

    response = submit(client, public_id)

    assert response.status_code == 200
    assert ServiceRequestNotification.query.count() == 0


def test_a_notification_failure_does_not_fail_the_submit(client, monkeypatch):
    make_carrier()

    def boom(*args, **kwargs):
        raise RuntimeError('smtp down')
    monkeypatch.setattr('app.api.service_request.notifications.send_email', boom)
    public_id = create_draft(client)
    fill(client, public_id)

    response = submit(client, public_id)

    assert response.status_code == 200
    assert ServiceRequest.query.one().status == 'submitted'


def test_notify_carriers_requires_the_internal_token(client):
    public_id = create_draft(client)
    fill(client, public_id)
    submit(client, public_id)
    service_request_id = ServiceRequest.query.one().id

    assert client.post(f'/api/v1/service-requests/{service_request_id}/notify-carriers').status_code == 403


def test_notify_carriers_reaches_only_the_ones_not_told_yet(client, sent, monkeypatch):
    monkeypatch.setenv('NOTIFY_EMAIL', 'admin@example.com')
    first = make_carrier('Embala SAC')
    public_id = create_draft(client)
    fill(client, public_id)
    submit(client, public_id)
    service_request_id = ServiceRequest.query.one().id
    sent['email'].clear()
    late = make_carrier('Tarde SAC')

    response = client.post(f'/api/v1/service-requests/{service_request_id}/notify-carriers',
                           headers=internal_headers())

    assert response.status_code == 200
    assert response.get_json()['notified_carrier_ids'] == [late.id]
    # Only the new carrier, and not the admin again.
    assert [e['to'] for e in sent['email']] == ['tarde@example.com']
    assert {n.carrier_company_id for n in ServiceRequestNotification.query.all()} == {first.id, late.id}


def test_notify_carriers_on_a_draft_is_rejected(client):
    public_id = create_draft(client)
    service_request_id = ServiceRequest.query.one().id

    response = client.post(f'/api/v1/service-requests/{service_request_id}/notify-carriers',
                           headers=internal_headers())

    assert response.status_code == 409


# --- media ----------------------------------------------------------------------

def presign(client, public_id, content_type='image/jpeg', size_bytes=1024):
    return client.post(f'/api/v1/service-requests/{public_id}/media/presign',
                       json={'content_type': content_type, 'size_bytes': size_bytes})


def test_presign_returns_a_key_under_the_request_prefix(client, storage):
    public_id = create_draft(client)

    response = presign(client, public_id, 'video/quicktime', 50 * 1024 * 1024)

    assert response.status_code == 200
    data = response.get_json()
    assert data['storage_key'].startswith(f'service-requests/{public_id}/')
    assert data['storage_key'].endswith('.mov')
    assert data['upload']['url'] == 'https://bucket.example'


@pytest.mark.parametrize('content_type, size_bytes', [
    ('application/pdf', 1024),
    ('image/svg+xml', 1024),
    ('image/jpeg', 10 * 1024 * 1024 + 1),
    ('video/mp4', 100 * 1024 * 1024 + 1),
    ('image/jpeg', 0),
    ('image/jpeg', 'grande'),
])
def test_presign_rejects_disallowed_types_and_sizes(client, storage, content_type, size_bytes):
    public_id = create_draft(client)

    assert presign(client, public_id, content_type, size_bytes).status_code == 400


def test_presign_rejects_the_eleventh_file(client, storage):
    public_id = create_draft(client)
    request_row = ServiceRequest.query.one()
    for n in range(10):
        db.session.add(ServiceRequestMedia(
            service_request_id=request_row.id, url=f'https://x/{n}', storage_key=f'k{n}', media_type='image'))
    db.session.commit()

    assert presign(client, public_id).status_code == 400


def test_register_creates_the_row_from_what_is_really_stored(client, storage):
    public_id = create_draft(client)
    key = presign(client, public_id).get_json()['storage_key']
    storage.stored[key] = {'size': 2048, 'content_type': 'image/jpeg'}

    response = client.post(f'/api/v1/service-requests/{public_id}/media', json={'storage_key': key})

    assert response.status_code == 201
    assert response.get_json()['media_type'] == 'image'
    media = ServiceRequestMedia.query.one()
    assert (media.size_bytes, media.url) == (2048, f'https://bucket.example/{key}')
    assert client.get(f'/api/v1/service-requests/{public_id}').get_json()['media'][0]['id'] == media.id


def test_register_is_idempotent(client, storage):
    public_id = create_draft(client)
    key = presign(client, public_id).get_json()['storage_key']
    storage.stored[key] = {'size': 2048, 'content_type': 'image/jpeg'}
    for _ in range(2):
        client.post(f'/api/v1/service-requests/{public_id}/media', json={'storage_key': key})

    assert ServiceRequestMedia.query.count() == 1


def test_register_rejects_a_key_of_another_request(client, storage):
    mine = create_draft(client)
    other = create_draft(client)
    key = presign(client, other).get_json()['storage_key']
    storage.stored[key] = {'size': 2048, 'content_type': 'image/jpeg'}

    response = client.post(f'/api/v1/service-requests/{mine}/media', json={'storage_key': key})

    assert response.status_code == 400
    assert ServiceRequestMedia.query.count() == 0


@pytest.mark.parametrize('suffix', ['../escape.jpg', 'sub/dir.jpg'])
def test_register_rejects_keys_that_leave_the_prefix(client, storage, suffix):
    public_id = create_draft(client)

    response = client.post(f'/api/v1/service-requests/{public_id}/media',
                           json={'storage_key': f'service-requests/{public_id}/{suffix}'})

    assert response.status_code == 400


def test_register_rejects_a_file_that_was_never_uploaded(client, storage):
    public_id = create_draft(client)
    key = presign(client, public_id).get_json()['storage_key']

    response = client.post(f'/api/v1/service-requests/{public_id}/media', json={'storage_key': key})

    assert response.status_code == 400


def test_register_deletes_a_stored_file_that_breaks_the_rules(client, storage):
    public_id = create_draft(client)
    key = presign(client, public_id).get_json()['storage_key']
    storage.stored[key] = {'size': 2048, 'content_type': 'application/pdf'}

    response = client.post(f'/api/v1/service-requests/{public_id}/media', json={'storage_key': key})

    assert response.status_code == 400
    assert storage.deleted == [key]
    assert ServiceRequestMedia.query.count() == 0


def test_delete_media_removes_it_from_storage_and_database(client, storage):
    public_id = create_draft(client)
    key = presign(client, public_id).get_json()['storage_key']
    storage.stored[key] = {'size': 2048, 'content_type': 'image/jpeg'}
    media_id = client.post(f'/api/v1/service-requests/{public_id}/media',
                           json={'storage_key': key}).get_json()['id']

    response = client.delete(f'/api/v1/service-requests/{public_id}/media/{media_id}')

    assert response.status_code == 204
    assert storage.deleted == [key]
    assert ServiceRequestMedia.query.count() == 0


def test_media_cannot_change_after_submit(client, storage):
    public_id = create_draft(client)
    fill(client, public_id)
    submit(client, public_id)

    assert presign(client, public_id).status_code == 409


# --- manual creation by an admin ----------------------------------------------------

MANUAL = {
    'service_type': 'packing',
    'address': {**ADDRESS, 'map_url': 'https://maps.app.goo.gl/abc123'},
    'preferred_date': TOMORROW,
    'whatsapp': '987654321',
    'items': [{'description': 'Sofá', 'quantity': 1, 'materials': ['stretch_film']}],
}


def manual(client, headers=True, **overrides):
    return client.post('/api/v1/service-requests/manual', json={**MANUAL, **overrides},
                       headers=internal_headers() if headers else {})


def test_manual_creation_requires_the_internal_token(client):
    assert manual(client, headers=False).status_code == 403
    assert ServiceRequest.query.count() == 0


def test_manual_request_is_born_submitted_and_tells_the_carriers_but_not_the_admin(client, sent, monkeypatch):
    monkeypatch.setenv('NOTIFY_EMAIL', 'admin@example.com')
    carrier = make_carrier()

    response = manual(client)

    assert response.status_code == 201
    saved = ServiceRequest.query.one()
    assert (saved.status, saved.whatsapp, saved.neighborhood) == ('submitted', '+51987654321', 'San Isidro')
    assert saved.submitted_at is not None
    assert [i.description for i in saved.items] == ['Sofá']
    assert response.get_json()['notified_carrier_ids'] == [carrier.id]
    # The admin who typed it in does not need an alert about their own request.
    assert [e['to'] for e in sent['email']] == ['embala@example.com']


def test_manual_request_can_wait_for_review_before_notifying(client, sent):
    make_carrier()

    response = manual(client, notify_carriers=False)

    assert response.status_code == 201
    assert response.get_json()['notified_carrier_ids'] == []
    assert sent['email'] == []
    assert ServiceRequestNotification.query.count() == 0


def test_an_admin_may_ask_for_today_but_not_for_the_past(client):
    assert manual(client, preferred_date='2026-10-05').status_code == 201
    assert manual(client, preferred_date='2026-10-04').status_code == 400


def test_the_customer_form_still_rejects_today(client):
    public_id = create_draft(client)

    response = client.patch(f'/api/v1/service-requests/{public_id}', json={'preferred_date': '2026-10-05'})

    assert response.status_code == 400


@pytest.mark.parametrize('overrides', [
    {'address': {**ADDRESS, 'neighborhood': '', 'map_url': 'https://maps.app.goo.gl/abc'}},
    {'address': {**ADDRESS, 'map_url': 'maps.app.goo.gl/abc'}},
    {'address': {**ADDRESS, 'map_url': ''}},
    {'items': []},
    {'items': [{'description': 'Sofá', 'quantity': 1, 'materials': ['unknown']}]},
    {'whatsapp': '12345'},
    {'whatsapp': None},
    {'preferred_date': None},
    {'service_type': 'cleaning'},
])
def test_manual_request_keeps_the_form_rules(client, overrides):
    assert manual(client, **overrides).status_code == 400
    assert ServiceRequest.query.count() == 0


# --- carrier quotations ---------------------------------------------------------------

def make_submitted(client):
    public_id = create_draft(client)
    fill(client, public_id)
    submit(client, public_id)
    return ServiceRequest.query.one().id


def quote(client, request_id, carrier_id, amount=350, note=None, internal=True):
    body = {'carrier_company_id': carrier_id, 'amount': amount}
    if note is not None:
        body['note'] = note
    return client.post(f'/api/v1/service-requests/{request_id}/quotations', json=body,
                       headers=internal_headers() if internal else {})


def select(client, request_id, quotation_id, admin_user_id=7, internal=True):
    return client.post(f'/api/v1/service-requests/{request_id}/quotations/{quotation_id}/select',
                       json={'admin_user_id': admin_user_id},
                       headers=internal_headers() if internal else {})


def test_quotation_endpoints_require_the_internal_token(client):
    request_id = make_submitted(client)
    carrier = make_carrier()

    assert quote(client, request_id, carrier.id, internal=False).status_code == 403
    assert select(client, request_id, 1, internal=False).status_code == 403
    assert ServiceRequestQuotation.query.count() == 0


def test_first_quote_is_201_and_quoting_again_updates_the_same_row(client):
    request_id = make_submitted(client)
    carrier = make_carrier()

    first = quote(client, request_id, carrier.id, amount=350, note='Incluye materiales')
    second = quote(client, request_id, carrier.id, amount='320.5', note='Rebajé el precio')

    assert (first.status_code, first.get_json()['created']) == (201, True)
    assert (second.status_code, second.get_json()['created']) == (200, False)
    saved = ServiceRequestQuotation.query.one()
    assert (float(saved.amount), saved.note, saved.status) == (320.5, 'Rebajé el precio', 'active')


def test_each_carrier_gets_their_own_quotation(client):
    request_id = make_submitted(client)
    first, second = make_carrier('Uno SAC'), make_carrier('Dos SAC')

    quote(client, request_id, first.id, amount=300)
    quote(client, request_id, second.id, amount=280)

    assert ServiceRequestQuotation.query.count() == 2


def test_quoting_a_draft_or_a_cancelled_request_is_409(client):
    carrier = make_carrier()
    public_id = create_draft(client)
    draft_id = ServiceRequest.query.one().id
    assert quote(client, draft_id, carrier.id).status_code == 409

    fill(client, public_id)
    submit(client, public_id)
    ServiceRequest.query.one().status = 'cancelled'
    db.session.commit()
    assert quote(client, draft_id, carrier.id).status_code == 409


def test_missing_request_or_carrier_is_404(client):
    request_id = make_submitted(client)
    carrier = make_carrier()

    assert quote(client, 9999, carrier.id).status_code == 404
    assert quote(client, request_id, 9999).status_code == 404


@pytest.mark.parametrize('amount', [0, -5, 100000.01, '100000.01', 'abc', '', None, True, 'NaN', 'Infinity', 0.004])
def test_invalid_amounts_are_rejected(client, amount):
    request_id = make_submitted(client)
    carrier = make_carrier()

    response = quote(client, request_id, carrier.id, amount=amount)

    assert response.status_code == 400
    assert ServiceRequestQuotation.query.count() == 0


def test_amount_is_rounded_to_cents_and_the_limit_is_inclusive(client):
    request_id = make_submitted(client)
    one, two = make_carrier('Uno SAC'), make_carrier('Dos SAC')

    assert quote(client, request_id, one.id, amount='350.555').status_code == 201
    assert quote(client, request_id, two.id, amount=100000).status_code == 201

    amounts = sorted(float(q.amount) for q in ServiceRequestQuotation.query.all())
    assert amounts == [350.56, 100000.0]


def test_the_carrier_id_must_be_a_number(client):
    request_id = make_submitted(client)

    for bad in (None, 'uno', True):
        assert quote(client, request_id, bad).status_code == 400


def test_note_is_trimmed_and_a_blank_one_is_stored_as_null(client):
    request_id = make_submitted(client)
    carrier = make_carrier()

    quote(client, request_id, carrier.id, note='   ')
    assert ServiceRequestQuotation.query.one().note is None
    quote(client, request_id, carrier.id, note='  vamos 2 personas  ')
    assert ServiceRequestQuotation.query.one().note == 'vamos 2 personas'


def test_a_note_over_500_characters_is_rejected(client):
    request_id = make_submitted(client)
    carrier = make_carrier()

    assert quote(client, request_id, carrier.id, note='x' * 501).status_code == 400
    assert quote(client, request_id, carrier.id, note='x' * 500).status_code == 201


def test_a_new_quotation_emails_and_whatsapps_the_admin(client, sent, monkeypatch):
    monkeypatch.setenv('NOTIFY_EMAIL', 'admin@example.com')
    monkeypatch.setenv('NOTIFY_WHATSAPP_PHONE', '999000111')
    request_id = make_submitted(client)
    carrier = make_carrier('Embala SAC')
    sent['email'].clear()
    sent['whatsapp'].clear()

    quote(client, request_id, carrier.id, amount=100, note='Incluye cajas')

    email = sent['email'][0]
    assert email['to'] == 'admin@example.com'
    assert email['template'] == 'email/service_request_quotation_admin'
    assert email['subject'] == f'Nueva cotización de Embala SAC para la solicitud #{request_id}'
    assert (email['amount'], email['total'], email['note']) == ('S/ 100.00', 'S/ 110.00', 'Incluye cajas')
    assert email['quotations_count'] == 1
    assert email['admin_url'] == f'https://chalan.pe/backoffice/service-requests/{request_id}'
    assert sent['whatsapp'][0]['phone'] == '999000111'
    assert sent['whatsapp'][0]['variables'] == {'1': 'Embala SAC', '2': email['admin_url']}


def test_updating_a_quotation_only_emails_the_admin(client, sent, monkeypatch):
    monkeypatch.setenv('NOTIFY_EMAIL', 'admin@example.com')
    monkeypatch.setenv('NOTIFY_WHATSAPP_PHONE', '999000111')
    request_id = make_submitted(client)
    carrier = make_carrier('Embala SAC')
    quote(client, request_id, carrier.id, amount=100)
    sent['email'].clear()
    sent['whatsapp'].clear()

    quote(client, request_id, carrier.id, amount=90)

    assert [e['subject'] for e in sent['email']] == [f'Embala SAC actualizó su cotización (#{request_id})']
    assert sent['whatsapp'] == []


def test_a_notification_failure_does_not_undo_the_quotation(client, monkeypatch):
    monkeypatch.setenv('NOTIFY_EMAIL', 'admin@example.com')
    request_id = make_submitted(client)
    carrier = make_carrier()

    def boom(*args, **kwargs):
        raise RuntimeError('smtp down')
    monkeypatch.setattr('app.api.service_request.notifications.send_email', boom)
    monkeypatch.setattr('app.api.service_request.notifications.send_whatsapp', boom)

    response = quote(client, request_id, carrier.id)

    assert response.status_code == 201
    assert ServiceRequestQuotation.query.count() == 1


def test_selecting_freezes_the_fee_and_the_total(client):
    request_id = make_submitted(client)
    carrier = make_carrier()
    quotation_id = quote(client, request_id, carrier.id, amount=100).get_json()['id']

    response = select(client, request_id, quotation_id, admin_user_id=7)

    assert response.status_code == 200
    assert response.get_json() == {'id': quotation_id, 'status': 'selected', 'amount': 100.0,
                                   'platform_fee_rate': 0.1, 'total_amount': 110.0}
    saved = ServiceRequestQuotation.query.one()
    assert (saved.status, float(saved.total_amount), saved.selected_by_admin_id) == ('selected', 110.0, 7)
    assert saved.selected_at is not None


def test_changing_the_fee_afterwards_does_not_move_a_frozen_total(client, monkeypatch):
    request_id = make_submitted(client)
    carrier = make_carrier()
    quotation_id = quote(client, request_id, carrier.id, amount=100).get_json()['id']
    select(client, request_id, quotation_id)

    monkeypatch.setenv('PLATFORM_FEE', '0.25')

    saved = ServiceRequestQuotation.query.one()
    assert (float(saved.total_amount), float(saved.platform_fee_rate)) == (110.0, 0.1)


def test_selecting_another_one_unmarks_the_previous_and_clears_its_frozen_fields(client):
    request_id = make_submitted(client)
    one, two = make_carrier('Uno SAC'), make_carrier('Dos SAC')
    first_id = quote(client, request_id, one.id, amount=100).get_json()['id']
    second_id = quote(client, request_id, two.id, amount=200).get_json()['id']
    select(client, request_id, first_id)

    select(client, request_id, second_id)

    first, second = db.session.get(ServiceRequestQuotation, first_id), db.session.get(ServiceRequestQuotation, second_id)
    assert (first.status, first.total_amount, first.platform_fee_rate, first.selected_at) == ('active', None, None, None)
    assert (second.status, float(second.total_amount)) == ('selected', 220.0)
    assert ServiceRequestQuotation.query.filter_by(status='selected').count() == 1


def test_selecting_the_same_one_twice_keeps_its_selected_at(client):
    request_id = make_submitted(client)
    carrier = make_carrier()
    quotation_id = quote(client, request_id, carrier.id, amount=100).get_json()['id']
    select(client, request_id, quotation_id)
    first_at = db.session.get(ServiceRequestQuotation, quotation_id).selected_at

    response = select(client, request_id, quotation_id, admin_user_id=99)

    assert response.status_code == 200
    saved = db.session.get(ServiceRequestQuotation, quotation_id)
    assert (saved.selected_at, saved.selected_by_admin_id) == (first_at, 7)


def test_select_of_a_quotation_from_another_request_is_404(client):
    request_id = make_submitted(client)
    carrier = make_carrier()
    other = ServiceRequest(public_id='z' * 32, service_type_id=ServiceType.query.first().id, status='submitted')
    db.session.add(other)
    db.session.commit()
    foreign = ServiceRequestQuotation(service_request_id=other.id, carrier_company_id=carrier.id, amount=50)
    db.session.add(foreign)
    db.session.commit()

    assert select(client, request_id, foreign.id).status_code == 404
    assert select(client, request_id, 9999).status_code == 404
    assert select(client, 9999, 1).status_code == 404


def test_select_on_a_cancelled_request_is_409(client):
    request_id = make_submitted(client)
    carrier = make_carrier()
    quotation_id = quote(client, request_id, carrier.id).get_json()['id']
    ServiceRequest.query.one().status = 'cancelled'
    db.session.commit()

    assert select(client, request_id, quotation_id).status_code == 409


def test_once_one_is_selected_nobody_else_can_quote_and_the_winner_cannot_change_it(client):
    request_id = make_submitted(client)
    winner, other = make_carrier('Gana SAC'), make_carrier('Otra SAC')
    winner_id = quote(client, request_id, winner.id, amount=100).get_json()['id']
    select(client, request_id, winner_id)

    from_other = quote(client, request_id, other.id, amount=50)
    from_winner = quote(client, request_id, winner.id, amount=10)

    assert (from_other.status_code, from_other.get_json()['message']) == (409, 'service request already assigned')
    assert (from_winner.status_code, from_winner.get_json()['message']) == (409, 'quotation already selected')
    assert float(db.session.get(ServiceRequestQuotation, winner_id).amount) == 100.0
    assert ServiceRequestQuotation.query.count() == 1


def test_selecting_without_a_platform_fee_configured_fails_instead_of_inventing_one(client, monkeypatch):
    request_id = make_submitted(client)
    carrier = make_carrier()
    quotation_id = quote(client, request_id, carrier.id).get_json()['id']
    monkeypatch.delenv('PLATFORM_FEE')

    with pytest.raises(RuntimeError):
        select(client, request_id, quotation_id)
    assert ServiceRequestQuotation.query.one().status == 'active'


# --- carrier declines -----------------------------------------------------------------

def decline(client, request_id, carrier_id, internal=True, method='post', **body):
    body.setdefault('reason', 'zone')
    return getattr(client, method)(f'/api/v1/service-requests/{request_id}/decline',
                                   json={'carrier_company_id': carrier_id, **body},
                                   headers=internal_headers() if internal else {})


def test_decline_requires_the_internal_token(client):
    request_id = make_submitted(client)
    carrier = make_carrier()

    assert decline(client, request_id, carrier.id, internal=False).status_code == 403
    assert ServiceRequestCarrierDecline.query.count() == 0


def test_declining_removes_the_carrier_quotation(client):
    request_id = make_submitted(client)
    carrier, other = make_carrier('Uno SAC'), make_carrier('Dos SAC')
    quote(client, request_id, carrier.id)
    quote(client, request_id, other.id)

    res = decline(client, request_id, carrier.id, reason='other', note='No tengo gente')

    assert res.status_code == 200
    assert res.get_json()['withdrew_quotation'] is True
    assert [q.carrier_company_id for q in ServiceRequestQuotation.query.all()] == [other.id]
    saved = ServiceRequestCarrierDecline.query.one()
    assert (saved.reason, saved.note) == ('other', 'No tengo gente')


def test_declining_an_assigned_request_is_409(client):
    request_id = make_submitted(client)
    winner, loser = make_carrier('Uno SAC'), make_carrier('Dos SAC')
    quotation_id = quote(client, request_id, winner.id).get_json()['id']
    select(client, request_id, quotation_id)

    assert decline(client, request_id, winner.id).get_json()['message'] == 'quotation already selected'
    assert decline(client, request_id, loser.id).get_json()['message'] == 'service request already assigned'
    assert ServiceRequestCarrierDecline.query.count() == 0


def test_quoting_after_declining_clears_the_decline_and_undo_deletes_it(client):
    request_id = make_submitted(client)
    carrier = make_carrier()

    decline(client, request_id, carrier.id)
    quote(client, request_id, carrier.id)
    assert ServiceRequestCarrierDecline.query.count() == 0

    decline(client, request_id, carrier.id)
    assert decline(client, request_id, carrier.id, method='delete').status_code == 200
    assert ServiceRequestCarrierDecline.query.count() == 0
