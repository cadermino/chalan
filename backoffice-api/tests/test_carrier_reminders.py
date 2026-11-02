"""El recordatorio por WhatsApp de lo que cada transportista tiene por cotizar.

Lo que se prueba es lo que haría mandar un recordatorio equivocado: una orden
que ya cotizó o rechazó, una que no se le mandó, una que ya pasó o ya tiene
transportista, y que la dirección no salga entera.
"""
from datetime import datetime, timedelta

import jwt
import pytest

from app import db
from app.models import Order, OrderCarrierDecline, OrderDetail, Quotation
from tests.test_service_requests import make_user
from tests.test_services_per_company import catalog, make_company  # noqa: F401


@pytest.fixture
def superadmin(app):
    return make_user('superadmin')


def make_order(days_ahead=3, **fields):
    values = {'order_status_id': 1, 'quotation_requested': True, 'customer_id': 1,
              'appointment_date': datetime.now() + timedelta(days=days_ahead), **fields}
    order = Order(**values)
    db.session.add(order)
    db.session.commit()
    db.session.add_all([
        OrderDetail(order_id=order.id, type='carry_from',
                    street='Av. Arnaldo Márquez 1772, Jesús María 15072, Perú', neighborhood='Fund Oyague'),
        OrderDetail(order_id=order.id, type='deliver_to',
                    street='Calle Los Pinos 120, Santiago de Surco 15038, Perú'),
    ])
    db.session.commit()
    return order


def reminders(client, headers):
    res = client.get('/api/orders/carrier-reminders', headers=headers)
    assert res.status_code == 200
    return {c['name']: c for c in res.get_json()['companies']}


def test_each_carrier_gets_only_what_it_has_not_answered(client, app, catalog, superadmin):
    quoted, declined, silent = (make_company(n, 'moving') for n in ('Cotizó', 'Rechazó', 'Callado'))
    make_company('Solo Embala', 'packing')
    order = make_order()
    db.session.add(Quotation(order_id=order.id, carrier_company_id=quoted.id, amount=300, quotation_status_id=1))
    db.session.add(OrderCarrierDecline(order_id=order.id, carrier_company_id=declined.id, reason='zone'))
    db.session.commit()

    companies = reminders(client, superadmin)

    assert list(companies) == ['Callado']
    [pending] = companies['Callado']['orders']
    assert pending['id'] == order.id
    assert (pending['origin_district'], pending['destination_district']) == ('Jesús María', 'Santiago de Surco')
    assert 'street' not in pending
    token = jwt.decode(pending['token'], app.config['SECRET_KEY'], algorithms=['HS256'])
    assert (token['carrier_company_id'], token['order_id']) == (silent.id, order.id)


def test_a_cancelled_quotation_still_counts_as_not_quoted(client, catalog, superadmin):
    company = make_company('Mudanzas SAC', 'moving')
    order = make_order()
    db.session.add(Quotation(order_id=order.id, carrier_company_id=company.id, amount=300, quotation_status_id=3))
    db.session.commit()

    assert [o['id'] for o in reminders(client, superadmin)['Mudanzas SAC']['orders']] == [order.id]


def test_orders_that_are_not_looking_for_quotes_are_left_out(client, catalog, superadmin):
    make_company('Mudanzas SAC', 'moving')
    other = make_company('Otra SAC', 'moving')
    soon = make_order(days_ahead=1)
    later = make_order(days_ahead=5)
    make_order(days_ahead=-1)                       # ya pasó
    make_order(quotation_requested=None)             # no se mandó: le faltan datos
    make_order(customer_id=None)                     # sin cliente
    make_order(order_status_id=2)                    # ya agendada
    picked = make_order()                            # elegida, con el yapeo en revisión
    db.session.add(Quotation(order_id=picked.id, carrier_company_id=other.id, amount=300, quotation_status_id=2))
    db.session.commit()

    assert [o['id'] for o in reminders(client, superadmin)['Mudanzas SAC']['orders']] == [soon.id, later.id]


def test_only_admins_see_it(client, catalog):
    company = make_company('Mudanzas SAC', 'moving')
    carrier = make_user('carrier_company', carrier_company_id=company.id, suffix='c')

    assert client.get('/api/orders/carrier-reminders', headers=carrier).status_code == 403
