"""Lo que ve una empresa de la dirección de una mudanza en el backoffice.

Antes de que la mudanza sea suya, solo el distrito: veía la calle sin el número,
y con eso ya podía ir a buscar al cliente por fuera de la plataforma. Agendada
con ella, la dirección completa. El admin siempre la ve entera.
"""
from app import db
from app.models import OrderDetail, Quotation
from tests.test_carrier_declines import carrier, carrier_user, make_order  # noqa: F401
from tests.test_service_requests import admin, make_carrier, make_user  # noqa: F401


def with_addresses(order, origin_neighborhood='Miraflores'):
    db.session.add_all([
        OrderDetail(order_id=order.id, type='carry_from', street='Av. Larco 1301, Miraflores 15074, Perú',
                    neighborhood=origin_neighborhood, city='Lima', floor_number=3, has_elevator=1),
        OrderDetail(order_id=order.id, type='deliver_to', street='Av. Arequipa 2450, Lince 15046, Perú',
                    neighborhood=None, city='Lima', floor_number=1, has_elevator=0),
    ])
    db.session.commit()
    return order


def detail(client, headers, order):
    return client.get(f'/api/orders/{order.id}', headers=headers).get_json()['order']


def test_a_carrier_sees_only_the_district_before_the_move_is_theirs(client, carrier, carrier_user):
    order = with_addresses(make_order())

    data = detail(client, carrier_user, order)

    assert (data['origin']['street'], data['origin']['neighborhood']) == (None, 'Miraflores')
    # Sin el distrito de Google, se saca del texto de la dirección.
    assert (data['destination']['street'], data['destination']['neighborhood']) == (None, 'Lince')
    assert data['origin']['address_hidden'] is True
    assert data['origin']['floor_number'] == 3


def test_chosen_but_not_yet_scheduled_still_shows_only_the_district(client, carrier, carrier_user):
    order = with_addresses(make_order(status=1))
    db.session.add(Quotation(order_id=order.id, carrier_company_id=carrier.id, amount=300, quotation_status_id=2))
    db.session.commit()

    assert detail(client, carrier_user, order)['origin']['street'] is None


def test_the_carrier_with_the_scheduled_move_sees_the_full_address(client, carrier, carrier_user):
    order = with_addresses(make_order(status=2))
    db.session.add(Quotation(order_id=order.id, carrier_company_id=carrier.id, amount=300, quotation_status_id=2))
    db.session.commit()

    data = detail(client, carrier_user, order)

    assert data['origin']['street'] == 'Av. Larco 1301, Miraflores 15074, Perú'
    assert data['origin']['address_hidden'] is False


def test_the_admin_always_sees_the_full_address(client, admin):
    order = with_addresses(make_order())

    assert detail(client, admin, order)['origin']['street'] == 'Av. Larco 1301, Miraflores 15074, Perú'
