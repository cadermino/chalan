from datetime import datetime

import pytest

from app import db
from app.api.decorators import generate_internal_token
from app.api.order import Order as OrderEntity
from app.api.order.steps.addresses import Addresses as AddressesStep
from app.api.orders import send_email_to_carrier_companies
from app.api.order.order_status import OrderStatus
from app.models import (CarrierCompanyServiceType, LuServices, Order, OrdersServices, Payment,
                        PaymentType, Quotations, ServiceType)


ORIGIN = {
    'from_street': 'Av. Javier Prado 123',
    'from_floor_number': 3,
    'from_country': 'Peru',
    'from_map_url': 'https://maps.google.com/x',
}
DESTINATION = {
    'to_street': 'Calle Mercaderes 456',
    'to_floor_number': 1,
    'to_country': 'Peru',
    'to_map_url': 'https://maps.google.com/y',
}


@pytest.fixture(autouse=True)
def _seed_services(app):
    db.session.add_all([
        LuServices(service='cargo', description='Cargadores'),
        LuServices(service='packaging', description='Embalaje'),
    ])
    db.session.commit()


def test_create_order_without_authenticated_customer_succeeds(client):
    # Customers fill out step-one (and even step-two) before logging in —
    # login/register is deferred to step-three. Vuex defaults customer_id to
    # null until then, so this is the default/most common path, not an edge
    # case. Regression test for the bug fixed in 9c23efb.
    res = client.post('/api/v1/order', json={
        'customer': {'customer_id': None},
        'orderDetailsOrigin': ORIGIN,
        'orderDetailsDestination': DESTINATION,
    })

    assert res.status_code == 201
    assert res.get_json()['order_id']


def test_create_order_with_real_customer_id_succeeds(client, customer):
    res = client.post('/api/v1/order', json={
        'customer': {'customer_id': customer.id},
        'orderDetailsOrigin': ORIGIN,
        'orderDetailsDestination': DESTINATION,
    })

    assert res.status_code == 201


def test_create_order_missing_customer_key_returns_clean_400(client):
    res = client.post('/api/v1/order', json={
        'orderDetailsOrigin': ORIGIN,
        'orderDetailsDestination': DESTINATION,
    })

    assert res.status_code == 400
    assert 'customer.customer_id' in res.get_json()['message']


def test_create_order_missing_order_details_returns_clean_400(client):
    res = client.post('/api/v1/order', json={
        'customer': {'customer_id': None},
        'orderDetailsDestination': DESTINATION,
    })

    assert res.status_code == 400
    assert 'orderDetailsOrigin' in res.get_json()['message']


def _create_order(client, customer):
    res = client.post('/api/v1/order', json={
        'customer': {'customer_id': customer.id},
        'orderDetailsOrigin': ORIGIN,
        'orderDetailsDestination': DESTINATION,
    })
    return res.get_json()['order_id']


def _make_belongings_complete(order_id):
    # Drives Order/OrdersServices state directly via the ORM rather than
    # through PUT /order/<id>: that endpoint writes appointment_date via a
    # raw ISO string (order.py:83, `order.appointment_date = request[...]`),
    # which Postgres/psycopg2 casts automatically but SQLAlchemy's SQLite
    # test dialect rejects outright ("only accepts Python datetime and date
    # objects"). Real production behavior is already verified separately
    # (curl against prod, see chalan-chatbot-quotation-spec.md) — this just
    # avoids a SQLite-only false failure while still exercising the real
    # send_email_to_carrier_companies()/is_complete() logic under test.
    order = db.session.get(Order, order_id)
    order.appointment_date = datetime(2026, 8, 20, 14, 0)
    order.comments = '1 sofa, 3 cajas'
    cargo = LuServices.query.filter_by(service='cargo').first()
    db.session.add(OrdersServices(order_id=order_id, service_id=cargo.id))
    db.session.commit()


def _offers_moving(company):
    # Desde la migración 022 una empresa recibe mudanzas solo si tiene el
    # servicio 'moving' marcado; antes bastaba con estar activa y en el país.
    moving = ServiceType.query.filter_by(code='moving').first()
    if moving is None:
        moving = ServiceType(code='moving', name='Mudanzas y fletes')
        db.session.add(moving)
        db.session.commit()
    db.session.add(CarrierCompanyServiceType(carrier_company_id=company.id, service_type_id=moving.id))
    db.session.commit()


def test_request_quotation_notifies_active_carrier_in_same_country(client, customer, carrier_company, monkeypatch):
    monkeypatch.setenv('COUNTRY_ID', '2')
    carrier_company.country_id = 2
    carrier_company.email = 'carrier@example.com'
    db.session.commit()
    _offers_moving(carrier_company)

    order_id = _create_order(client, customer)
    _make_belongings_complete(order_id)

    emails_sent = send_email_to_carrier_companies(order_id, {'requestQuotationFromCarrierCompany': True})

    assert emails_sent == [carrier_company.id]


def test_active_carrier_without_the_moving_service_is_not_notified(client, customer, carrier_company, monkeypatch):
    # Una empresa que solo embala o solo arma muebles, activa y en el país, no
    # recibe órdenes de mudanza.
    monkeypatch.setenv('COUNTRY_ID', '2')
    carrier_company.country_id = 2
    carrier_company.email = 'carrier@example.com'
    db.session.commit()

    order_id = _create_order(client, customer)
    _make_belongings_complete(order_id)

    emails_sent = send_email_to_carrier_companies(order_id, {'requestQuotationFromCarrierCompany': True})

    assert emails_sent == []


def test_carrier_with_no_country_id_is_never_notified(client, customer, carrier_company, monkeypatch):
    # Regression test for the country_id bug fixed in aeaeb36: a carrier
    # self-registered via /transportistas never had country_id set, so it
    # was silently excluded from every notification despite being active.
    monkeypatch.setenv('COUNTRY_ID', '2')
    carrier_company.country_id = None  # simulates the pre-fix self-registration bug
    db.session.commit()
    _offers_moving(carrier_company)  # so the missing country is the only reason it is left out

    order_id = _create_order(client, customer)
    _make_belongings_complete(order_id)

    emails_sent = send_email_to_carrier_companies(order_id, {'requestQuotationFromCarrierCompany': True})

    assert emails_sent == []


def test_no_trigger_flag_notifies_nobody(client, customer, carrier_company, monkeypatch):
    # Completing address + belongings alone never notifies carriers — only
    # the explicit requestQuotationFromCarrierCompany flag does (Step-three.vue's
    # mount-time PUT). This is intentional, but easy to assume is automatic.
    monkeypatch.setenv('COUNTRY_ID', '2')
    carrier_company.country_id = 2
    db.session.commit()

    order_id = _create_order(client, customer)
    _make_belongings_complete(order_id)

    emails_sent = send_email_to_carrier_companies(order_id, {})

    assert emails_sent == []


def _update_payload(loaders_quantity=None):
    return {
        'customer': {'customer_id': None},
        'order': {
            'appointment_date': datetime(2026, 8, 20, 14, 0),
            'comments': '1 sofa, 3 cajas',
            'approximate_budget': 500,
            'loaders_quantity': loaders_quantity,
        },
        'orderDetailsOrigin': ORIGIN,
        'orderDetailsDestination': DESTINATION,
        'services': {'cargo': '1', 'packaging': '0'},
    }


def test_update_order_sets_loaders_quantity(client, customer):
    order_id = _create_order(client, customer)

    OrderEntity(order_id).update(_update_payload(loaders_quantity=3))

    order = db.session.get(Order, order_id)
    assert order.loaders_quantity == 3


def test_update_order_without_loaders_quantity_stays_none(client, customer):
    # loaders_quantity is optional — the "no extra loaders" case must not crash
    # or silently coerce to 0 (customer.get() returns None when absent).
    order_id = _create_order(client, customer)

    OrderEntity(order_id).update(_update_payload())

    order = db.session.get(Order, order_id)
    assert order.loaders_quantity is None


def test_ground_floor_counts_as_a_complete_address(client, customer):
    # Piso 0 es planta baja, no un campo vacío. Con bool() esas direcciones
    # quedaban incompletas para siempre y la orden nunca salía a cotizar.
    order_id = _create_order(client, customer)
    for detail in db.session.get(Order, order_id).order_details:
        detail.floor_number = 0
        detail.map_url = 'https://maps.google.com/z'
    db.session.commit()

    assert AddressesStep(order_id).is_complete() is True


def _auth(customer):
    return {'Authorization': f'Bearer {customer.generate_auth_token(3600)}'}


def _internal_auth():
    return {'Authorization': f'Bearer {generate_internal_token()}'}


def _route_update_payload(edited_by_customer):
    """Cuerpo de PUT /order/<id> tal como lo manda un cliente real.

    appointment_date va en None a proposito: la ruta escribe el string crudo
    del JSON (order.py:130) y el SQLite de estas pruebas solo acepta datetime
    de Python. Lo que se verifica aca es si la ruta escribe, no que formato de
    fecha parsea.
    """
    payload = {
        'customer': {'customer_id': None},
        'order': {
            'appointment_date': None,
            'comments': '1 sofa, 3 cajas',
            'approximate_budget': 500,
            'loaders_quantity': 2,
        },
        'orderDetailsOrigin': ORIGIN,
        'orderDetailsDestination': DESTINATION,
        'services': {'cargo': '1', 'packaging': '0'},
    }
    if edited_by_customer:
        payload['orderEditedByCustomer'] = True
    return payload


def test_put_with_edit_flag_persists_the_order(client, customer):
    # Los otros tests de update() llaman a OrderEntity directo y se saltean la
    # ruta, que es por donde entra todo el trafico real. Esta prueba existe
    # porque 02e8f88 dejo de escribir por HTTP sin que nada se pusiera en rojo:
    # el endpoint siguio respondiendo 200 "updated!" durante cuatro dias.
    order_id = _create_order(client, customer)

    res = client.put(
        f'/api/v1/order/{order_id}',
        json=_route_update_payload(edited_by_customer=True),
        headers=_auth(customer),
    )

    assert res.status_code == 200
    order = db.session.get(Order, order_id)
    assert order.comments == '1 sofa, 3 cajas'
    assert order.loaders_quantity == 2
    assert order.approximate_budget == 500
    assert [row.service.service for row in order.services] == ['cargo']


def test_put_without_edit_flag_writes_nothing(client, customer):
    # Login, registro, el paso tres y el modal de pago reenvian la orden entera
    # desde el localStorage del navegador: de esos PUT solo se toma ligar al
    # cliente. Sin esta prueba, sacar el guard de 02e8f88 vuelve a dejar que un
    # login pise la orden con una copia vieja y le cancele las cotizaciones.
    order_id = _create_order(client, customer)

    res = client.put(
        f'/api/v1/order/{order_id}',
        json=_route_update_payload(edited_by_customer=False),
        headers=_auth(customer),
    )

    assert res.status_code == 200
    order = db.session.get(Order, order_id)
    assert order.comments is None
    assert order.loaders_quantity is None
    assert order.services.count() == 0


def test_put_reports_what_it_wrote(client, customer):
    # El 200 de esta ruta no distinguia un PUT que escribio todo de uno que no
    # escribio nada, y por eso el bug de 02e8f88 vivio cuatro dias en dos
    # clientes a la vez. La respuesta ahora lo dice.
    order_id = _create_order(client, customer)

    full = client.put(
        f'/api/v1/order/{order_id}',
        json=_route_update_payload(edited_by_customer=True),
        headers=_auth(customer),
    ).get_json()

    assert full['written'] == 'full'
    assert 'comments' in full['fields_written']
    assert 'loaders_quantity' in full['fields_written']
    assert 'updated!' in full['message']

    link_only = client.put(
        f'/api/v1/order/{order_id}',
        json=_route_update_payload(edited_by_customer=False),
        headers=_auth(customer),
    ).get_json()

    assert link_only['written'] == 'customer_link'
    assert link_only['fields_written'] == []
    assert 'updated!' not in link_only['message']


def test_internal_caller_without_the_edit_flag_is_rejected(client, customer):
    # El backoffice-api manda el cuerpo entero a proposito y siempre quiere
    # escribirlo; si olvida la marca es un bug nuestro, no un navegador
    # reenviando localStorage. Controlamos las dos puntas, asi que falla fuerte.
    order_id = _create_order(client, customer)

    res = client.put(
        f'/api/v1/order/{order_id}',
        json=_route_update_payload(edited_by_customer=False),
        headers=_internal_auth(),
    )

    assert res.status_code == 400
    assert 'orderEditedByCustomer' in res.get_json()['message']


def test_internal_caller_with_the_edit_flag_writes(client, customer):
    order_id = _create_order(client, customer)

    res = client.put(
        f'/api/v1/order/{order_id}',
        json=_route_update_payload(edited_by_customer=True),
        headers=_internal_auth(),
    )

    assert res.status_code == 200
    assert res.get_json()['written'] == 'full'
    assert db.session.get(Order, order_id).comments == '1 sofa, 3 cajas'


def _checkout_setup(monkeypatch, carrier_company, required):
    """Entorno común de los tests de checkout. Devuelve la lista de correos enviados."""
    from app.api.order import order as order_module
    order_module._PAYMENT_TYPE_IDS.clear()
    monkeypatch.setenv('PLATFORM_FEE', '0.1')
    monkeypatch.setenv('SITE_URL', 'https://chalan.pe/')
    monkeypatch.setenv('ADMIN_MAIL', 'ops@example.com')
    monkeypatch.setenv('OPS_MAIL', 'ops@example.com')
    if required:
        monkeypatch.setenv('YAPE_RESERVATION_REQUIRED', 'true')
    else:
        monkeypatch.delenv('YAPE_RESERVATION_REQUIRED', raising=False)

    sent = []
    monkeypatch.setattr(
        'app.api.orders.send_email',
        lambda to, subject, template, *args, **kwargs: sent.append((to, template, kwargs)),
    )

    db.session.add_all([PaymentType(type='cash'), PaymentType(type='yape')])
    carrier_company.email = 'carrier@example.com'
    db.session.commit()
    return sent


def _order_with_selected_quotation(client, customer, carrier_company, amount=200):
    order_id = _create_order(client, customer)
    db.session.add(Quotations(
        order_id=order_id,
        carrier_company_id=carrier_company.id,
        amount=amount,
        quotation_status_id=2,
    ))
    db.session.commit()
    return order_id


def _checkout(client, customer, order_id, operation_number=None):
    body = {'operation_number': operation_number} if operation_number is not None else None
    return client.put(f'/api/v1/order/checkout-cash/{order_id}', headers=_auth(customer), json=body)


def _templates(sent):
    return [template for _, template, _ in sent]


def test_cash_checkout_without_required_reservation_moves_to_in_progress(client, customer, carrier_company, monkeypatch):
    # Agendar es lo unico que pone la orden en marcha. Antes ese estado lo
    # escribia el PUT del modal de pago, que desde 02e8f88 no escribe nada, y
    # la orden se quedaba en pending aunque estuviera cobrada: el transportista
    # no la veia en su lista y no podia marcarla completada. Sin la exigencia
    # de la reserva (YAPE_RESERVATION_REQUIRED) sigue siendo asi.
    sent = _checkout_setup(monkeypatch, carrier_company, required=False)
    order_id = _order_with_selected_quotation(client, customer, carrier_company)
    assert db.session.get(Order, order_id).order_status_id == OrderStatus.pending()

    res = _checkout(client, customer, order_id)

    assert res.status_code == 200
    assert res.get_json()['created'] is True
    assert res.get_json()['awaiting_verification'] is False
    assert db.session.get(Order, order_id).order_status_id == OrderStatus.in_progress()
    assert _templates(sent) == ['email/admin_new_order', 'email/cash_payment_selected']


def test_scheduled_emails_carry_both_parties_contact_details(client, customer, carrier_company, monkeypatch):
    # Una vez agendada, cliente y transportista coordinan directo: los dos
    # correos llevan nombre y teléfono de ambos, con enlace a WhatsApp.
    sent = _checkout_setup(monkeypatch, carrier_company, required=False)
    customer.mobile_phone = '987654321'
    carrier_company.phone = '+51 912 345 678'
    db.session.commit()
    order_id = _order_with_selected_quotation(client, customer, carrier_company)

    _checkout(client, customer, order_id)

    expected = {
        'customer_full_name': 'Nathalia Caceres',
        'customer_phone': '987654321',
        'customer_whatsapp_url': 'https://wa.me/51987654321',
        'carrier_name': 'Jhon Romero',
        'carrier_phone': '+51 912 345 678',
        'carrier_whatsapp_url': 'https://wa.me/51912345678',
    }
    for _, _, kwargs in sent:
        assert {key: kwargs[key] for key in expected} == expected


def test_each_scheduled_email_shows_only_the_other_partys_details(app, customer, carrier_company):
    # Cada uno ya sabe sus propios datos: el cliente ve al transportista y el
    # transportista ve al cliente, no al revés.
    from flask import render_template
    from app.api.orders import _contact_details
    customer.mobile_phone = '987654321'
    carrier_company.phone = '912345678'
    contact = _contact_details(customer, carrier_company)

    with app.test_request_context():
        to_customer = render_template('email/cash_payment_selected.html', customer_name=customer.name,
                                      mobile_phone=customer.mobile_phone, **contact)
        to_carrier = render_template('email/admin_new_order.html',
                                     carrier_company_orders_url='https://chalan.pe/x', **contact)

    assert 'Jhon Romero' in to_customer and '912345678' in to_customer
    assert 'Nathalia Caceres' not in to_customer
    assert 'Nathalia Caceres' in to_carrier and '987654321' in to_carrier
    assert 'Jhon Romero' not in to_carrier and '912345678' not in to_carrier


def test_contact_details_without_a_usable_phone_have_no_whatsapp_link(client, customer, carrier_company, monkeypatch):
    sent = _checkout_setup(monkeypatch, carrier_company, required=False)
    customer.mobile_phone = '123'
    db.session.commit()
    order_id = _order_with_selected_quotation(client, customer, carrier_company)

    _checkout(client, customer, order_id)

    for _, _, kwargs in sent:
        assert kwargs['customer_whatsapp_url'] is None
        assert kwargs['carrier_phone'] is None
        assert kwargs['carrier_whatsapp_url'] is None


def test_cash_checkout_is_idempotent(client, customer, carrier_company, monkeypatch):
    # Volver desde el dashboard y confirmar otra vez la misma cotizacion pasa
    # por aca de nuevo: ni duplica pagos ni reenvia correos, y el estado ya
    # escrito se queda como esta. Con la reserva exigida, la orden sigue en
    # pending hasta que un admin confirme el yapeo.
    sent = _checkout_setup(monkeypatch, carrier_company, required=True)
    order_id = _order_with_selected_quotation(client, customer, carrier_company)

    _checkout(client, customer, order_id, '12345678')
    again = _checkout(client, customer, order_id, '12345678')

    assert again.get_json()['created'] is False
    assert db.session.get(Order, order_id).order_status_id == OrderStatus.pending()
    assert _templates(sent) == ['email/yape_reservation_submitted', 'email/yape_reservation_received']


def test_checkout_requires_operation_number(client, customer, carrier_company, monkeypatch):
    sent = _checkout_setup(monkeypatch, carrier_company, required=True)
    order_id = _order_with_selected_quotation(client, customer, carrier_company)

    for bad in (None, '', 'abc', '12', '1' * 21):
        res = _checkout(client, customer, order_id, bad)
        assert res.status_code == 400
        assert res.get_json()['message'] == 'invalid_operation_number'

    assert db.session.get(Order, order_id).order_status_id == OrderStatus.pending()
    assert Payment.query.filter_by(order_id=order_id).count() == 0
    assert sent == []


def test_checkout_with_operation_number_keeps_order_pending(client, customer, carrier_company, monkeypatch):
    sent = _checkout_setup(monkeypatch, carrier_company, required=True)
    order_id = _order_with_selected_quotation(client, customer, carrier_company)

    # Los separadores se limpian: el cliente puede pegar "N.° 123-456".
    res = _checkout(client, customer, order_id, '123-456 78')

    assert res.status_code == 200
    body = res.get_json()
    assert body['created'] is True
    assert body['awaiting_verification'] is True
    reservation = Payment.query.filter_by(order_id=order_id, concept='reservation').one()
    assert reservation.reference == '12345678'
    assert reservation.status == 'pending'
    assert reservation.amount == 20
    assert db.session.get(Order, order_id).order_status_id == OrderStatus.pending()
    assert _templates(sent) == ['email/yape_reservation_submitted', 'email/yape_reservation_received']
    assert 'email/admin_new_order' not in _templates(sent)
    ops_to, _, ops_kwargs = sent[0]
    assert ops_to == 'ops@example.com'
    assert ops_kwargs['operation_number'] == '12345678'
    assert ops_kwargs['reservation_amount'] == '20.00'


def test_checkout_rejects_reused_operation_number(client, customer, carrier_company, monkeypatch):
    _checkout_setup(monkeypatch, carrier_company, required=True)
    first = _order_with_selected_quotation(client, customer, carrier_company)
    second = _order_with_selected_quotation(client, customer, carrier_company)

    assert _checkout(client, customer, first, '12345678').status_code == 200
    res = _checkout(client, customer, second, '12345678')

    assert res.status_code == 409
    assert res.get_json()['message'] == 'operation_number_already_used'
    assert Payment.query.filter_by(order_id=second).count() == 0

    # Una reserva cancelada libera el número.
    Payment.query.filter_by(order_id=first, concept='reservation').one().status = 'cancelled'
    db.session.commit()
    assert _checkout(client, customer, second, '12345678').status_code == 200


def test_checkout_retry_updates_pending_reference(client, customer, carrier_company, monkeypatch):
    _checkout_setup(monkeypatch, carrier_company, required=True)
    order_id = _order_with_selected_quotation(client, customer, carrier_company)

    _checkout(client, customer, order_id, '11111111')
    again = _checkout(client, customer, order_id, '22222222')

    assert again.get_json()['created'] is False
    reservation = Payment.query.filter_by(order_id=order_id, concept='reservation').one()
    assert reservation.reference == '22222222'

    # Una vez que un admin la dio por pagada, el número quedó verificado y no
    # se reescribe.
    reservation.status = 'paid'
    db.session.commit()
    _checkout(client, customer, order_id, '33333333')
    assert Payment.query.filter_by(order_id=order_id, concept='reservation').one().reference == '22222222'


def test_confirm_reservation_moves_order_to_in_progress(client, customer, carrier_company, monkeypatch):
    sent = _checkout_setup(monkeypatch, carrier_company, required=True)
    order_id = _order_with_selected_quotation(client, customer, carrier_company)
    _checkout(client, customer, order_id, '12345678')
    sent.clear()

    res = client.post(f'/api/v1/order/{order_id}/confirm-reservation', headers=_internal_auth())

    assert res.status_code == 200
    assert res.get_json() == {'confirmed': True}
    assert db.session.get(Order, order_id).order_status_id == OrderStatus.in_progress()
    assert _templates(sent) == ['email/admin_new_order', 'email/cash_payment_selected']
    receipt = sent[1][2]
    assert receipt['reservation_amount'] == '20.00'
    assert receipt['operation_number'] == '12345678'
    assert receipt['carrier_amount'] == '200.00'
    for _, _, kwargs in sent:
        assert kwargs['customer_full_name'] == 'Nathalia Caceres'
        assert kwargs['carrier_name'] == 'Jhon Romero'

    sent.clear()
    again = client.post(f'/api/v1/order/{order_id}/confirm-reservation', headers=_internal_auth())
    assert again.get_json() == {'confirmed': False}
    assert sent == []


def test_confirm_reservation_is_internal_only(client, customer, carrier_company, monkeypatch):
    _checkout_setup(monkeypatch, carrier_company, required=True)
    order_id = _order_with_selected_quotation(client, customer, carrier_company)
    _checkout(client, customer, order_id, '12345678')

    for headers in ({}, _auth(customer)):
        res = client.post(f'/api/v1/order/{order_id}/confirm-reservation', headers=headers)
        assert res.status_code == 403
    assert db.session.get(Order, order_id).order_status_id == OrderStatus.pending()


def test_confirm_reservation_needs_a_selected_quotation(client, customer, monkeypatch, carrier_company):
    _checkout_setup(monkeypatch, carrier_company, required=True)
    order_id = _create_order(client, customer)

    res = client.post(f'/api/v1/order/{order_id}/confirm-reservation', headers=_internal_auth())

    assert res.status_code == 409
    assert db.session.get(Order, order_id).order_status_id == OrderStatus.pending()


def test_empty_numeric_strings_do_not_blow_up_the_route(client, customer):
    # Vaciar "Número de cargadores" en el paso dos manda '' (v-model sobre un
    # input number no da null). Asignarlo a una columna Integer es un DataError
    # y el cliente se come un 500 por borrar el número para escribir otro.
    order_id = _create_order(client, customer)
    payload = _route_update_payload(edited_by_customer=True)
    payload['order']['loaders_quantity'] = ''
    payload['order']['approximate_budget'] = ''

    res = client.put(
        f'/api/v1/order/{order_id}',
        json=payload,
        headers=_auth(customer),
    )

    assert res.status_code == 200
    order = db.session.get(Order, order_id)
    assert order.loaders_quantity is None
    assert order.approximate_budget == 0
