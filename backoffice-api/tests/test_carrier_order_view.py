"""Lo que una empresa ve de una orden en el backoffice antes de que sea suya.

La lista le daba el nombre del cliente de cada orden, y el detalle un link de
cotizar para cualquier orden: con ese link el API principal devolvía la calle
completa de una mudanza que ya era de otra empresa.
"""
from app import db
from app.models import Customer, Quotation
from tests.test_carrier_declines import carrier, carrier_user, make_order  # noqa: F401
from tests.test_service_requests import make_carrier, make_user


def _with_customer(order):
    customer = Customer(name='Nathalia', paternal_last_name='Caceres', email='n@example.com')
    db.session.add(customer)
    db.session.commit()
    order.customer_id = customer.id
    db.session.commit()
    return order


def test_the_list_does_not_name_the_customer_to_a_carrier(client, carrier, carrier_user):
    # La lista solo trae órdenes que la empresa todavía puede cotizar: ninguna es
    # suya aún, así que el nombre queda para los admins, como en el detalle.
    order = _with_customer(make_order())
    admin = make_user('admin')

    seen_by_carrier = client.get('/api/orders/pending', headers=carrier_user).get_json()['orders']
    seen_by_admin = client.get('/api/orders/pending', headers=admin).get_json()['orders']

    assert [o['customer_name'] for o in seen_by_carrier if o['id'] == order.id] == [None]
    assert [o['customer_name'] for o in seen_by_admin if o['id'] == order.id] == ['Nathalia Caceres']


def test_the_quotation_link_is_only_for_pending_orders_or_the_carriers_own(client, carrier, carrier_user):
    other = make_carrier(name='Otra SAC')
    pending, lost, mine = make_order(), make_order(2), make_order(2)
    db.session.add_all([
        Quotation(order_id=lost.id, carrier_company_id=other.id, amount=300, quotation_status_id=2),
        Quotation(order_id=mine.id, carrier_company_id=carrier.id, amount=320, quotation_status_id=2),
    ])
    db.session.commit()

    def link(order):
        return client.get(f'/api/orders/{order.id}', headers=carrier_user).get_json()['order']['quotation_url']

    assert link(pending) is not None
    assert link(lost) is None
    assert link(mine) is not None
