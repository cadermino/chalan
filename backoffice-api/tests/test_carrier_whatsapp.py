"""Avisar a los transportistas por WhatsApp a mano, desde el detalle de la orden.

Lo que se prueba es lo que haría escribirle a quien no toca, o no escribirle a
quien sí: quién falta, que una orden que cambió vuelva a pedir el aviso y que
una orden que ya no busca cotizaciones no pida ninguno.
"""
from datetime import datetime, timedelta

import pytest

from app import db
from app.models import Order, OrderCarrierDecline, OrderDetail, Quotation
from tests.test_service_requests import make_user
from tests.test_services_per_company import catalog, make_company  # noqa: F401


@pytest.fixture
def superadmin(app):
    return make_user('superadmin')


def make_order(**fields):
    values = {'order_status_id': 1, 'quotation_requested': True, 'customer_id': 1,
              'carrier_notified_at': datetime.utcnow() - timedelta(hours=1),
              'appointment_date': datetime.now() + timedelta(days=3), **fields}
    order = Order(**values)
    db.session.add(order)
    db.session.commit()
    db.session.add_all([
        OrderDetail(order_id=order.id, type='carry_from', street='Av. Arnaldo Márquez 1772, Jesús María 15072, Perú'),
        OrderDetail(order_id=order.id, type='deliver_to', street='Calle Los Pinos 120, Santiago de Surco 15038, Perú'),
    ])
    db.session.commit()
    return order


def links(client, headers, order):
    res = client.get(f'/api/orders/{order.id}/quotation-links', headers=headers)
    assert res.status_code == 200
    return res.get_json()


def test_only_the_ones_that_have_not_answered_are_due(client, catalog, superadmin):
    quoted, declined, changed, silent = (make_company(n, 'moving') for n in ('Cotizó', 'Rechazó', 'Cambió', 'Callado'))
    order = make_order()
    db.session.add_all([
        Quotation(order_id=order.id, carrier_company_id=quoted.id, amount=300, quotation_status_id=1),
        Quotation(order_id=order.id, carrier_company_id=changed.id, amount=280, quotation_status_id=3),
        OrderCarrierDecline(order_id=order.id, carrier_company_id=declined.id, reason='zone'),
    ])
    db.session.commit()

    body = links(client, superadmin, order)
    companies = {c['name']: c for c in body['companies']}

    assert body['looking'] is True
    assert (body['order']['origin_district'], body['order']['destination_district']) == ('Jesús María', 'Santiago de Surco')
    assert {n for n, c in companies.items() if c['to_notify']} == {'Cambió', 'Callado'}
    assert companies['Cotizó']['quotation_amount'] == 300
    assert companies['Rechazó']['declined'] is True
    assert (companies['Cambió']['requote'], companies['Callado']['requote']) == (True, False)


def test_writing_to_one_takes_it_off_until_the_order_is_sent_again(client, catalog, superadmin):
    company = make_company('Mudanzas SAC', 'moving')
    order = make_order()

    res = client.post(f'/api/orders/{order.id}/carrier-whatsapp', headers=superadmin,
                      json={'carrier_company_id': company.id})

    assert res.status_code == 200
    assert res.get_json()['whatsapp_at'].endswith('Z')
    [row] = links(client, superadmin, order)['companies']
    assert (row['to_notify'], row['whatsapp_at'] is not None) == (False, True)

    # La orden cambió y se volvió a mandar: el WhatsApp de antes ya no vale.
    db.session.get(Order, order.id).carrier_notified_at = datetime.utcnow() + timedelta(minutes=1)
    db.session.commit()
    assert links(client, superadmin, order)['companies'][0]['to_notify'] is True

    client.post(f'/api/orders/{order.id}/carrier-whatsapp', headers=superadmin,
                json={'carrier_company_id': company.id})
    db.session.expire_all()
    from app.models import OrderCarrierWhatsapp
    assert OrderCarrierWhatsapp.query.one().sent_count == 2


@pytest.mark.parametrize('fields', [
    {'quotation_requested': None},
    {'order_status_id': 2},
    {'appointment_date': datetime.now() - timedelta(days=2)},
])
def test_an_order_that_is_not_looking_for_quotes_asks_for_none(client, catalog, superadmin, fields):
    make_company('Mudanzas SAC', 'moving')
    order = make_order(**fields)

    body = links(client, superadmin, order)

    assert body['looking'] is False
    assert body['companies'][0]['to_notify'] is False


def test_a_selected_quotation_ends_the_search(client, catalog, superadmin):
    chosen, other = make_company('Elegida', 'moving'), make_company('Otra', 'moving')
    order = make_order()
    db.session.add(Quotation(order_id=order.id, carrier_company_id=chosen.id, amount=300, quotation_status_id=2))
    db.session.commit()

    body = links(client, superadmin, order)

    assert body['looking'] is False
    assert not any(c['to_notify'] for c in body['companies'])


def test_only_admins_and_real_companies(client, catalog, superadmin):
    company = make_company('Mudanzas SAC', 'moving')
    carrier = make_user('carrier_company', carrier_company_id=company.id, suffix='c')
    order = make_order()

    assert client.post(f'/api/orders/{order.id}/carrier-whatsapp', headers=carrier,
                       json={'carrier_company_id': company.id}).status_code == 403
    assert client.post(f'/api/orders/{order.id}/carrier-whatsapp', headers=superadmin,
                       json={'carrier_company_id': 9999}).status_code == 404
    assert client.post(f'/api/orders/{order.id}/carrier-whatsapp', headers=superadmin,
                       json={'carrier_company_id': str(company.id)}).status_code == 404
