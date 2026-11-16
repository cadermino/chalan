"""Avisar por WhatsApp a mano en una solicitud de servicio: a las empresas que
faltan y al cliente de sus cotizaciones, como en las órdenes (migración 053).

Lo que se prueba es lo que haría escribirle a quien no toca: a una empresa que
ya cotizó o no puede, en una solicitud que ya no busca precios, y no marcar
como nueva una cotización que llegó después del aviso al cliente.
"""
from decimal import Decimal

from app import db
from app.models import ServiceRequestCarrierDecline, ServiceRequestCarrierWhatsapp, ServiceRequestQuotation
from tests.test_service_requests import admin, make_carrier, materials, packing, submitted  # noqa: F401


def detail(client, headers, service_request):
    res = client.get(f'/api/service-requests/{service_request.id}', headers=headers)
    assert res.status_code == 200
    return res.get_json()['service_request']


def quote(service_request, carrier, amount, status='active'):
    quotation = ServiceRequestQuotation(service_request_id=service_request.id, carrier_company_id=carrier.id,
                                        amount=Decimal(amount), status=status)
    db.session.add(quotation)
    db.session.commit()
    return quotation


def test_only_the_companies_that_have_not_answered_are_due(client, admin, submitted, packing):
    quoted, declined, silent = (make_carrier(packing, name=n) for n in ('Cotizó', 'Rechazó', 'Callado'))
    silent.coordinator_name, silent.phone = 'Jackelinne Rojas', '957417814'
    quote(submitted, quoted, 300)
    db.session.add(ServiceRequestCarrierDecline(service_request_id=submitted.id, carrier_company_id=declined.id,
                                                reason='zone'))
    db.session.commit()

    body = detail(client, admin, submitted)
    links = {link['name']: link for link in body['links']}

    assert body['looking'] is True
    assert {n for n, link in links.items() if link['to_notify']} == {'Callado'}
    assert links['Cotizó']['quotation_amount'] == 300
    assert links['Rechazó']['declined'] is True
    assert (links['Callado']['coordinator_name'], links['Callado']['phone']) == ('Jackelinne Rojas', '957417814')


def test_writing_to_one_takes_it_off(client, admin, submitted, packing):
    carrier = make_carrier(packing)

    res = client.post(f'/api/service-requests/{submitted.id}/carrier-whatsapp', headers=admin,
                      json={'carrier_company_id': carrier.id})
    client.post(f'/api/service-requests/{submitted.id}/carrier-whatsapp', headers=admin,
                json={'carrier_company_id': carrier.id})

    assert res.status_code == 200
    [link] = detail(client, admin, submitted)['links']
    assert (link['to_notify'], link['whatsapp_at'] is not None) == (False, True)
    assert ServiceRequestCarrierWhatsapp.query.one().sent_count == 2


def test_a_selected_quotation_or_a_cancelled_request_ends_the_search(client, admin, submitted, packing):
    chosen = make_carrier(packing, name='Elegida')
    make_carrier(packing, name='Otra')
    quote(submitted, chosen, 300, status='selected')

    body = detail(client, admin, submitted)
    assert body['looking'] is False
    assert not any(link['to_notify'] for link in body['links'])

    submitted.status = 'cancelled'
    db.session.commit()
    assert detail(client, admin, submitted)['looking'] is False


def test_a_quotation_after_the_customer_reminder_is_new(client, admin, submitted, packing):
    first = quote(submitted, make_carrier(packing, name='Primera'), 300)
    assert detail(client, admin, submitted)['new_quotation'] is False   # nunca se le avisó

    res = client.post(f'/api/service-requests/{submitted.id}/customer-reminded', headers=admin,
                      json={'quotation_id': first.id})
    assert res.status_code == 200
    body = detail(client, admin, submitted)
    assert (body['new_quotation'], body['customer_reminder_count']) == (False, 1)

    quote(submitted, make_carrier(packing, name='Segunda'), 250)
    assert detail(client, admin, submitted)['new_quotation'] is True


def test_a_quotation_that_came_in_while_the_page_was_open_still_counts_as_new(client, admin, submitted, packing):
    first = quote(submitted, make_carrier(packing, name='Primera'), 300)
    quote(submitted, make_carrier(packing, name='Segunda'), 250)

    client.post(f'/api/service-requests/{submitted.id}/customer-reminded', headers=admin,
                json={'quotation_id': first.id})

    assert detail(client, admin, submitted)['new_quotation'] is True


def test_only_admins_and_real_companies(client, admin, submitted, packing):
    from tests.test_service_requests import make_user
    carrier = make_carrier(packing)
    carrier_headers = make_user('carrier_company', carrier_company_id=carrier.id, suffix='c')

    assert client.post(f'/api/service-requests/{submitted.id}/carrier-whatsapp', headers=carrier_headers,
                       json={'carrier_company_id': carrier.id}).status_code == 403
    assert client.post(f'/api/service-requests/{submitted.id}/customer-reminded',
                       headers=carrier_headers).status_code == 403
    assert client.post(f'/api/service-requests/{submitted.id}/carrier-whatsapp', headers=admin,
                       json={'carrier_company_id': 9999}).status_code == 404


def test_each_company_gets_its_short_link_code(client, admin, submitted, packing):
    from app.quotation_short_link import make_service_code
    carrier = make_carrier(packing)

    [link] = detail(client, admin, submitted)['links']

    assert link['code'] == make_service_code(submitted.id, carrier.id)
