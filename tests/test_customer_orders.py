from app import db
from app.models import Order


def _auth_header(customer):
    token = customer.generate_auth_token(3600)
    return {'Authorization': f'Bearer {token}'}


def test_customer_orders_with_no_orders_returns_empty_list(client, customer):
    # Regression test: order.quotations was accessed before the
    # `if order is None` check, so a customer with zero orders (the normal
    # state right after registering) crashed with an uncaught
    # AttributeError: 'NoneType' object has no attribute 'quotations',
    # surfaced as a raw 500 on GET /customer/<id>/orders.
    res = client.get(f'/api/v1/customer/{customer.id}/orders', headers=_auth_header(customer))

    assert res.status_code == 200
    assert res.get_json() == []


def test_customer_orders_with_order_but_no_selected_quotation(client, customer):
    # Second bug in the same function: carrier_company_name assumed a
    # selected Quotations row always exists, crashing for the normal state
    # of a freshly created order (no quotation picked yet).
    order = Order(customer_id=customer.id)
    db.session.add(order)
    db.session.commit()

    res = client.get(f'/api/v1/customer/{customer.id}/orders', headers=_auth_header(customer))

    assert res.status_code == 200
    body = res.get_json()
    assert len(body) == 1
    assert body[0]['carrier_company_name'] == '-'
    assert body[0]['amount'] == '-'


def test_order_detail_works_when_the_chosen_company_has_no_vehicles(client, customer, order, carrier_company):
    # The detail took carrier_company.vehicles[0] and crashed with IndexError
    # (a raw 500) once the chosen company had no vehicles, which admins can
    # now cause by deleting them.
    from app.api.quotation.quotation_status import QuotationStatus
    from app.models import Quotations
    db.session.add(Quotations(amount=450, order_id=order.id, carrier_company_id=carrier_company.id,
                              quotation_status_id=QuotationStatus.Selected()))
    db.session.commit()

    res = client.get(f'/api/v1/order/{order.id}', headers=_auth_header(customer))

    assert res.status_code == 200
    body = res.get_json()['order']
    assert body['amount'] == 450
    assert body['vehicle'] == {}


def _booked(order, carrier_company, status, reservation_status, reference='12345678'):
    """Una mudanza con cotización elegida de 300 y sus dos pagos, como los deja el checkout."""
    from app.api.order.order_status import OrderStatus
    from app.api.quotation.quotation_status import QuotationStatus
    from app.models import Payment, PaymentType, Quotations
    carrier_company.phone = '987 654 321'
    quotation = Quotations(amount=300, order_id=order.id, carrier_company_id=carrier_company.id,
                           quotation_status_id=QuotationStatus.Selected())
    payment_type = PaymentType(type='cash')
    db.session.add_all([quotation, payment_type])
    db.session.commit()
    db.session.add_all([
        Payment(order_id=order.id, lu_payment_type_id=payment_type.id, amount=30, concept='reservation',
                status=reservation_status, reference=reference, quotation_id=quotation.id),
        Payment(order_id=order.id, lu_payment_type_id=payment_type.id, amount=300, concept='carrier_cash',
                status='pending', quotation_id=quotation.id),
    ])
    order.order_status_id = getattr(OrderStatus, status)()
    db.session.commit()


def test_another_customer_cannot_read_your_orders(client, customer, order):
    # token_required solo validaba el token: cambiando el número de la URL se
    # leía el último pedido de otra persona.
    from app.models import Customer
    other = Customer(name='Otra', email='otra@example.com')
    db.session.add(other)
    db.session.commit()

    res = client.get(f'/api/v1/customer/{customer.id}/orders', headers=_auth_header(other))

    assert res.status_code == 403


def test_a_confirmed_move_shows_the_carrier_and_what_is_left_to_pay(client, customer, order,
                                                                   carrier_company, monkeypatch):
    monkeypatch.setenv('PLATFORM_FEE', '0.1')
    _booked(order, carrier_company, 'in_progress', 'paid')

    res = client.get(f'/api/v1/customer/{customer.id}/orders', headers=_auth_header(customer))

    body = res.get_json()[0]
    assert body['status'] == 'in_progress'
    assert body['total_amount'] == 330
    assert body['carrier_amount'] == 300
    assert body['reservation'] == {'amount': 30, 'status': 'paid', 'reference': '12345678'}
    assert body['carrier_cash_status'] == 'pending'
    assert body['carrier_contact'] == {
        'name': 'Jhon Romero',
        'phone': '987 654 321',
        'whatsapp_url': 'https://wa.me/51987654321',
    }


def test_the_carrier_contact_waits_until_the_yapeo_is_confirmed(client, customer, order,
                                                                 carrier_company, monkeypatch):
    # Hasta que un admin confirma el yapeo el transportista no recibió el pedido.
    monkeypatch.setenv('PLATFORM_FEE', '0.1')
    _booked(order, carrier_company, 'pending', 'pending')

    res = client.get(f'/api/v1/customer/{customer.id}/orders', headers=_auth_header(customer))

    body = res.get_json()[0]
    assert body['status'] == 'pending'
    assert body['reservation']['status'] == 'pending'
    assert body['carrier_contact'] is None
