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
