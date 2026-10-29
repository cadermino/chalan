"""Solicitudes de armado y desarmado de muebles (/armado/cotizar).

Mismo flujo que embalaje, con tres diferencias: cada mueble dice qué hay que
hacer (armar, desarmar, o desarmar acá y armar en el destino), puede pedirse
embalado con los materiales del catálogo de embalaje, y si alguno se arma en
otro lado hace falta la dirección de destino.
"""
import pytest

from app import db
from app.models import CarrierCompanyServiceType, ServiceRequest, ServiceType
from tests.test_service_requests import (ADDRESS, TOMORROW, catalog, create_draft,  # noqa: F401
                                         internal_headers, lima_clock, make_carrier, sent, submit)

DESTINATION = {**ADDRESS, 'street': 'Jr. Ica 450, Huancayo', 'neighborhood': 'Huancayo',
               'map_url': 'https://maps.google.com/?cid=2'}


@pytest.fixture(autouse=True)
def furniture(catalog):  # noqa: F811
    service_type = ServiceType(code='furniture_assembly', name='Armado y desarmado de muebles', requestable=1)
    db.session.add(service_type)
    db.session.commit()
    return service_type


def assembler(name='Arma SAC'):
    carrier = make_carrier(name, packing=False)
    service_type = ServiceType.query.filter_by(code='furniture_assembly').one()
    db.session.add(CarrierCompanyServiceType(carrier_company_id=carrier.id, service_type_id=service_type.id))
    db.session.commit()
    return carrier


def draft(client):
    return create_draft(client, service_type='furniture_assembly')


def patch(client, public_id, **body):
    return client.patch(f'/api/v1/service-requests/{public_id}', json=body)


def test_each_piece_says_what_to_do_and_whether_to_pack_it(client):
    public_id = draft(client)

    response = patch(client, public_id, preferred_date=TOMORROW, items=[
        {'description': 'Ropero 2 puertas', 'quantity': 1, 'work': 'assemble'},
        {'description': 'Cama queen', 'quantity': 1, 'work': 'disassemble', 'pack': True,
         'materials': ['stretch_film']},
    ])

    assert response.status_code == 200
    items = response.get_json()['items']
    assert [(i['work'], i['pack'], i['materials']) for i in items] == [
        ('assemble', False, []), ('disassemble', True, ['stretch_film'])]


def test_materials_come_from_the_packing_catalog(client):
    response = client.get('/api/v1/service-types/furniture_assembly/materials')

    assert response.status_code == 200
    assert [m['code'] for m in response.get_json()] == ['cardboard_sheet', 'stretch_film', 'carpet']


def test_a_piece_not_packed_keeps_no_materials(client):
    public_id = draft(client)

    response = patch(client, public_id, items=[
        {'description': 'Escritorio', 'work': 'assemble', 'pack': False, 'materials': ['carpet']}])

    assert response.get_json()['items'][0]['materials'] == []


@pytest.mark.parametrize('item', [
    {'description': 'Ropero'},
    {'description': 'Ropero', 'work': 'paint'},
    {'description': 'Ropero', 'work': 'assemble', 'pack': 'yes'},
    {'description': 'Ropero', 'work': 'assemble', 'pack': True, 'materials': ['mop']},
])
def test_invalid_pieces_are_rejected(client, item):
    assert patch(client, draft(client), items=[item]).status_code == 400


def test_a_piece_assembled_elsewhere_needs_the_destination(client):
    public_id = draft(client)
    patch(client, public_id, preferred_date=TOMORROW,
          items=[{'description': 'Ropero', 'work': 'both'}])

    assert submit(client, public_id).status_code == 400
    assert patch(client, public_id, details={'destination': DESTINATION}).status_code == 200
    response = submit(client, public_id)

    assert response.status_code == 200
    assert response.get_json()['details']['destination']['neighborhood'] == 'Huancayo'


def test_the_destination_must_be_picked_from_google(client):
    response = patch(client, draft(client), details={'destination': {**DESTINATION, 'map_url': ''}})

    assert response.status_code == 400
    assert 'details.destination.map_url' in response.get_json()['message']


def test_a_destination_nobody_needs_is_dropped_on_submit(client):
    public_id = draft(client)
    patch(client, public_id, preferred_date=TOMORROW, details={'destination': DESTINATION},
          items=[{'description': 'Ropero', 'work': 'both'}])
    patch(client, public_id, items=[{'description': 'Ropero', 'work': 'assemble'}])

    response = submit(client, public_id)

    assert response.status_code == 200
    assert 'destination' not in response.get_json()['details']


def test_only_assemblers_hear_about_it(client, sent):  # noqa: F811
    make_carrier('Embala SAC')
    carrier = assembler()
    public_id = draft(client)
    patch(client, public_id, preferred_date=TOMORROW, items=[{'description': 'Ropero', 'work': 'assemble'}])

    submit(client, public_id)

    assert [e['to'] for e in sent['email']] == ['arma@example.com']
    assert ServiceRequest.query.one().notifications[0].carrier_company_id == carrier.id


def test_packing_requests_ignore_the_assembly_fields(client):
    public_id = create_draft(client)

    response = patch(client, public_id, items=[
        {'description': 'Sofá', 'work': 'both', 'pack': False, 'materials': ['carpet']}])

    item = response.get_json()['items'][0]
    assert (item['work'], item['pack'], item['materials']) == (None, None, ['carpet'])


MANUAL = {
    'service_type': 'furniture_assembly',
    'whatsapp': '987654321',
    'customer_name': 'Carla',
    'preferred_date': TOMORROW,
    'address': {**ADDRESS, 'map_url': 'https://maps.app.goo.gl/abc'},
    'items': [{'description': 'Ropero', 'quantity': 1, 'work': 'both', 'pack': True}],
    'details': {'destination': {**DESTINATION, 'map_url': 'https://maps.app.goo.gl/def'}},
    'notify_carriers': False,
}


def test_an_admin_can_type_one_in_with_its_destination(client):
    response = client.post('/api/v1/service-requests/manual', json=MANUAL, headers=internal_headers())

    assert response.status_code == 201, response.get_json()
    saved = ServiceRequest.query.one()
    assert saved.details['destination']['neighborhood'] == 'Huancayo'
    assert (saved.items[0].work, saved.items[0].pack) == ('both', True)


@pytest.mark.parametrize('details', [
    {},
    {'destination': {**DESTINATION, 'neighborhood': ''}},
    {'destination': {**DESTINATION, 'map_url': 'maps.app.goo.gl/def'}},
])
def test_a_typed_in_destination_follows_the_manual_rules(client, details):
    response = client.post('/api/v1/service-requests/manual', json={**MANUAL, 'details': details},
                           headers=internal_headers())

    assert response.status_code == 400
    assert ServiceRequest.query.count() == 0
