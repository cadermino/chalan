"""La lista de solicitudes de servicio del transportista, para volver a cotizar.

El aviso trae un link que vence a los 10 días: esta lista da uno nuevo. Lo que
se prueba es lo que no debe ver: otros servicios, borradores, canceladas, las
que se le dieron a otra empresa, y que solo la pida una empresa.
"""
from datetime import datetime

import jwt

from app import db
from app.models import CarrierCompanyServiceType, ServiceRequest, ServiceRequestCarrierDecline, ServiceType
from tests.test_service_requests import (SECRET, admin, make_carrier, make_quotation, make_user,  # noqa: F401
                                         materials, packing, submitted)


def packer(packing):
    carrier = make_carrier(packing_type=packing)
    return carrier, make_user('carrier_company', carrier_company_id=carrier.id, suffix=f'c{carrier.id}')


def another_request(service_type, **fields):
    values = dict(public_id=f'{fields.pop("n", 1):032d}', service_type_id=service_type.id, status='pending',
                  street='Av. Arequipa 100', neighborhood='Lince', submitted_at=datetime(2026, 10, 6))
    values.update(fields)
    service_request = ServiceRequest(**values)
    db.session.add(service_request)
    db.session.commit()
    return service_request


def test_lists_the_requests_of_its_services_with_a_fresh_link(client, packing, submitted):
    carrier, headers = packer(packing)

    [row] = client.get('/api/carrier/service-requests', headers=headers).get_json()['service_requests']

    assert (row['id'], row['quotation_state'], row['neighborhood'], row['items_count']) == (
        submitted.id, 'open', 'San Isidro', 2)
    token = row['carrier_path'].removeprefix('/carrier-view/')
    payload = jwt.decode(token, SECRET, algorithms=['HS256'])
    assert (payload['service_request_id'], payload['carrier_company_id']) == (submitted.id, carrier.id)
    # Sin el WhatsApp ni la calle del cliente: solo el distrito.
    assert 'whatsapp' not in row and 'street' not in row


def test_leaves_out_other_services_drafts_cancelled_and_others_jobs(client, packing, submitted):
    carrier, headers = packer(packing)
    painting = ServiceType(code='painting', name='Pintura')
    db.session.add(painting)
    db.session.commit()
    another_request(painting, n=2)
    another_request(packing, n=3, submitted_at=None)               # borrador
    another_request(packing, n=4, status='cancelled')
    given_away = another_request(packing, n=5)
    make_quotation(given_away, make_carrier(name='Otra SAC'), 300, status='selected')
    won = another_request(packing, n=6, status='in_progress')
    make_quotation(won, carrier, 250, status='selected')

    rows = client.get('/api/carrier/service-requests', headers=headers).get_json()['service_requests']

    assert {r['id']: r['quotation_state'] for r in rows} == {submitted.id: 'open', won.id: 'selected_mine'}


def test_shows_its_own_quote_and_decline(client, packing, submitted):
    carrier, headers = packer(packing)
    declined = another_request(packing, n=7)
    make_quotation(submitted, carrier, 180)
    db.session.add(ServiceRequestCarrierDecline(service_request_id=declined.id, carrier_company_id=carrier.id,
                                                reason='zone'))
    db.session.commit()

    rows = client.get('/api/carrier/service-requests', headers=headers).get_json()['service_requests']

    assert {r['id']: (r['my_quotation'], r['declined']) for r in rows} == {
        submitted.id: (180.0, False), declined.id: (None, True)}


def test_an_inactive_company_sees_nothing(client, packing, submitted):
    carrier, headers = packer(packing)
    carrier.active = 0
    db.session.commit()

    assert client.get('/api/carrier/service-requests', headers=headers).get_json()['service_requests'] == []


def test_only_carrier_companies(client, admin):
    assert client.get('/api/carrier/service-requests', headers=admin).status_code == 403
