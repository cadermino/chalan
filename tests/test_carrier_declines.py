"""El transportista avisa que no puede hacer una mudanza.

Las pruebas van contra la ruta HTTP: la empresa sale del token del link (o, con
el token interno del backoffice-api, del cuerpo), y nunca del cuerpo con el
token del link.
"""
import pytest

from app import db
from app.api.carrier_company import CarrierCompany as CarrierCompanyEntity
from app.api.decorators import generate_internal_token
from app.models import CarrierCompany, Order, OrderCarrierDecline, Quotations

ACTIVE, SELECTED, CANCELLED = 1, 2, 3


@pytest.fixture(autouse=True)
def quiet(monkeypatch):
    monkeypatch.setattr('app.api.quotations.send_email', lambda *a, **kw: None)
    monkeypatch.setattr('app.api.quotations.send_whatsapp', lambda *a, **kw: None)
    monkeypatch.setenv('SITE_URL', 'https://chalan.pe/')


def link_headers(order_id, carrier_id):
    token = CarrierCompanyEntity().generate_carrier_company_token(3600, order_id, carrier_id)
    return {'Authorization': f'Bearer {token}'}


def internal_headers():
    return {'Authorization': f'Bearer {generate_internal_token()}'}


def decline(client, order_id, headers, **body):
    body.setdefault('reason', 'zone')
    return client.post(f'/api/v1/order/{order_id}/decline', json=body, headers=headers)


def add_quotation(order_id, carrier_id, status=ACTIVE, amount=450):
    quotation = Quotations(order_id=order_id, carrier_company_id=carrier_id,
                           amount=amount, quotation_status_id=status)
    db.session.add(quotation)
    db.session.commit()
    return quotation


def test_declining_from_the_link_records_the_reason(client, order, carrier_company):
    res = decline(client, order.id, link_headers(order.id, carrier_company.id),
                  reason='date_unavailable', note='  Ese día ya tengo otra  ')

    assert res.status_code == 200
    assert res.get_json()['withdrew_quotation'] is False
    saved = OrderCarrierDecline.query.one()
    assert (saved.carrier_company_id, saved.reason, saved.note) == (
        carrier_company.id, 'date_unavailable', 'Ese día ya tengo otra')


def test_the_link_of_another_order_is_rejected(client, order, carrier_company, customer):
    other = Order(customer_id=customer.id)
    db.session.add(other)
    db.session.commit()

    res = decline(client, order.id, link_headers(other.id, carrier_company.id))

    assert res.status_code == 400
    assert OrderCarrierDecline.query.count() == 0


def test_without_credentials_it_is_401(client, order):
    assert decline(client, order.id, {}).status_code == 401


def test_the_body_cannot_choose_the_company_with_a_link_token(client, order, carrier_company):
    intruder = CarrierCompany(name='Otra SAC', active=1)
    db.session.add(intruder)
    db.session.commit()

    decline(client, order.id, link_headers(order.id, carrier_company.id),
            carrier_company_id=intruder.id)

    assert OrderCarrierDecline.query.one().carrier_company_id == carrier_company.id


@pytest.mark.parametrize('body', [
    {'reason': 'porque no'},
    {'reason': None},
    {'reason': 'other'},
    {'reason': 'other', 'note': '   '},
    {'reason': 'zone', 'note': 'x' * 501},
    {'reason': 'zone', 'note': 5},
])
def test_invalid_reasons_and_notes_are_rejected(client, order, carrier_company, body):
    res = client.post(f'/api/v1/order/{order.id}/decline', json=body,
                      headers=link_headers(order.id, carrier_company.id))

    assert res.status_code == 400
    assert OrderCarrierDecline.query.count() == 0


def test_declining_withdraws_the_live_quotation(client, order, carrier_company):
    quotation = add_quotation(order.id, carrier_company.id)

    res = decline(client, order.id, link_headers(order.id, carrier_company.id))

    assert res.get_json()['withdrew_quotation'] is True
    assert db.session.get(Quotations, quotation.id).quotation_status_id == CANCELLED


def test_a_selected_quotation_cannot_be_declined(client, order, carrier_company):
    quotation = add_quotation(order.id, carrier_company.id, status=SELECTED)

    res = decline(client, order.id, link_headers(order.id, carrier_company.id))

    assert res.status_code == 409
    assert db.session.get(Quotations, quotation.id).quotation_status_id == SELECTED
    assert OrderCarrierDecline.query.count() == 0


def test_an_order_that_is_not_pending_cannot_be_declined(client, order, carrier_company):
    order.order_status_id = 2
    db.session.commit()

    assert decline(client, order.id, link_headers(order.id, carrier_company.id)).status_code == 409


def test_declining_again_updates_the_same_row(client, order, carrier_company):
    headers = link_headers(order.id, carrier_company.id)
    decline(client, order.id, headers, reason='zone')
    decline(client, order.id, headers, reason='budget')

    assert [d.reason for d in OrderCarrierDecline.query.all()] == ['budget']


def test_undo_deletes_the_decline(client, order, carrier_company):
    headers = link_headers(order.id, carrier_company.id)
    decline(client, order.id, headers)

    res = client.delete(f'/api/v1/order/{order.id}/decline', headers=headers)

    assert res.status_code == 200
    assert OrderCarrierDecline.query.count() == 0


def test_quoting_after_declining_clears_the_decline(client, order, carrier_company):
    headers = link_headers(order.id, carrier_company.id)
    decline(client, order.id, headers)

    res = client.post('/api/v1/quotations', json={'amount': 500}, headers=headers)

    assert res.status_code == 201
    assert OrderCarrierDecline.query.count() == 0


def test_the_carrier_page_reports_the_decline(client, order, carrier_company):
    headers = link_headers(order.id, carrier_company.id)
    assert client.get('/api/v1/orders/details', headers=headers).get_json()['decline'] is None

    decline(client, order.id, headers, reason='vehicle')

    assert client.get('/api/v1/orders/details', headers=headers).get_json()['decline']['reason'] == 'vehicle'


def test_the_backoffice_declines_with_the_internal_token(client, order, carrier_company):
    res = decline(client, order.id, internal_headers(), carrier_company_id=carrier_company.id)
    assert res.status_code == 200

    res = client.delete(f'/api/v1/order/{order.id}/decline', headers=internal_headers(),
                        json={'carrier_company_id': carrier_company.id})
    assert res.status_code == 200
    assert OrderCarrierDecline.query.count() == 0


def test_the_internal_token_needs_a_company(client, order):
    for bad in (None, 'uno', True):
        assert decline(client, order.id, internal_headers(), carrier_company_id=bad).status_code == 400
