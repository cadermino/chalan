"""Avisos push del navegador a transportistas (app/api/carrier_push.py)."""
from datetime import datetime

import pytest

from app import db
from app.api import carrier_push
from app.api.carrier_company import CarrierCompany as CarrierCompanyEntity
from app.api.orders import send_email_to_carrier_companies
from app.models import CarrierCompany, CarrierPushSubscription, Order, OrderDetails, Quotations

from test_orders import (_seed_services, _auth, _checkout, _checkout_setup, _create_order, _make_belongings_complete,
                         _offers_moving, _order_with_selected_quotation)  # noqa: F401 (_seed_services: fixture autouse)

PUBLIC = 'B' + 'A' * 86
OTHER_PUBLIC = 'B' + 'C' * 86
P256DH = 'B' + 'x' * 86
AUTH = 'y' * 22
FCM = 'https://fcm.googleapis.com/fcm/send/abc123'


@pytest.fixture(autouse=True)
def push_keys(monkeypatch):
    monkeypatch.setenv('WEB_PUSH_PUBLIC_KEY', PUBLIC)
    monkeypatch.setenv('WEB_PUSH_PRIVATE_KEY', 'private-key-for-tests')


@pytest.fixture
def sent(monkeypatch):
    """Lo que salió hacia el servicio de push; `sent.reply` es lo que contesta."""
    class Calls(list):
        reply = (201, None)

    calls = Calls()

    def fake_send(subscription_info, payload):
        calls.append((subscription_info['endpoint'], payload))
        return calls.reply

    monkeypatch.setattr(carrier_push, '_send', fake_send)
    return calls


def _link(company_id, order_id=1):
    token = CarrierCompanyEntity().generate_carrier_company_token(3600, order_id, company_id)
    return {'Authorization': f'Bearer {token}'}


def _subscribe(client, company_id, endpoint=FCM, **keys):
    body = {'endpoint': endpoint, 'keys': {'p256dh': P256DH, 'auth': AUTH, **keys}}
    return client.post('/api/v1/carrier-push-subscriptions', json=body, headers=_link(company_id))


def _subscription(company_id, endpoint=FCM, key=PUBLIC):
    row = CarrierPushSubscription(carrier_company_id=company_id, endpoint=endpoint, p256dh=P256DH,
                                  auth=AUTH, vapid_public_key=key)
    db.session.add(row)
    db.session.commit()
    return row


def _message(order_id=7):
    return {'title': 'Nueva orden para cotizar', 'body': 'x', 'url': 'https://chalan.pe/quotation/t?r=push',
            'tag': f'order-{order_id}'}


# --- Clave pública -----------------------------------------------------------

def test_public_key_is_null_while_push_is_off(client, monkeypatch):
    assert client.get('/api/v1/web-push/public-key').get_json() == {'public_key': PUBLIC}
    monkeypatch.delenv('WEB_PUSH_PRIVATE_KEY')
    assert client.get('/api/v1/web-push/public-key').get_json() == {'public_key': None}


def test_generated_keys_have_the_browser_format():
    public, private = carrier_push.generate_keys()
    assert len(public) == 87 and public.startswith('B')
    assert len(private) == 43


# --- Suscribirse ---------------------------------------------------------------

def test_the_quotation_link_subscribes_its_company(client, carrier_company):
    res = _subscribe(client, carrier_company.id)

    assert (res.status_code, res.get_json()) == (201, {'subscribed': True})
    row = CarrierPushSubscription.query.one()
    assert (row.carrier_company_id, row.endpoint, row.p256dh, row.auth, row.vapid_public_key) == \
        (carrier_company.id, FCM, P256DH, AUTH, PUBLIC)


def test_subscribing_again_updates_the_row_and_moves_it_to_the_new_company(client, carrier_company):
    other = CarrierCompany(name='Otra', active=1)
    db.session.add(other)
    db.session.commit()
    _subscribe(client, carrier_company.id)
    row = CarrierPushSubscription.query.one()
    row.failure_count, row.last_error = 3, '500 boom'
    db.session.commit()

    res = _subscribe(client, other.id, auth='z' * 22)

    assert res.status_code == 200
    row = CarrierPushSubscription.query.one()
    assert (row.carrier_company_id, row.auth, row.failure_count, row.last_error) == (other.id, 'z' * 22, 0, None)


def test_subscribing_needs_a_quotation_link_token(client, carrier_company, customer):
    body = {'endpoint': FCM, 'keys': {'p256dh': P256DH, 'auth': AUTH}}
    assert client.post('/api/v1/carrier-push-subscriptions', json=body).status_code == 401
    # El de un cliente también está firmado con SECRET_KEY, pero no es de un link.
    res = client.post('/api/v1/carrier-push-subscriptions', json=body, headers=_auth(customer))
    assert res.status_code == 400
    assert _subscribe(client, 999).status_code == 404
    assert CarrierPushSubscription.query.count() == 0


@pytest.mark.parametrize('endpoint', [
    'https://evil.example.com/push',
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com.evil.com/x',
    'https://169.254.169.254/latest/meta-data',
])
def test_only_known_push_services_are_accepted(client, carrier_company, endpoint):
    # El servidor le hace un POST al endpoint: no puede ser cualquier URL.
    res = _subscribe(client, carrier_company.id, endpoint=endpoint)
    assert (res.status_code, res.get_json()['message']) == (400, 'unsupported_push_service')


def test_apple_and_mozilla_endpoints_are_accepted(client, carrier_company):
    assert _subscribe(client, carrier_company.id, endpoint='https://web.push.apple.com/QGx').status_code == 201
    assert _subscribe(client, carrier_company.id,
                      endpoint='https://updates.push.services.mozilla.com/wpush/v2/x').status_code == 201


def test_malformed_keys_are_refused(client, carrier_company):
    assert _subscribe(client, carrier_company.id, p256dh='short').get_json()['message'] == 'invalid_keys'
    assert _subscribe(client, carrier_company.id, auth='no spaces allowed!!!!').get_json()['message'] == 'invalid_keys'


def test_subscribing_while_push_is_off_is_409(client, carrier_company, monkeypatch):
    monkeypatch.delenv('WEB_PUSH_PUBLIC_KEY')
    assert _subscribe(client, carrier_company.id).status_code == 409


def test_a_company_keeps_its_newest_browsers_only(client, carrier_company, monkeypatch):
    monkeypatch.setattr(carrier_push, 'MAX_PER_COMPANY', 2)
    for n in range(3):
        _subscribe(client, carrier_company.id, endpoint=f'{FCM}-{n}')

    endpoints = {row.endpoint for row in CarrierPushSubscription.query.all()}
    assert endpoints == {f'{FCM}-1', f'{FCM}-2'}


# --- Mandar ----------------------------------------------------------------------

def test_a_successful_push_stamps_the_row(app, carrier_company, sent):
    row = _subscription(carrier_company.id)
    row.failure_count = 2
    db.session.commit()

    assert carrier_push.notify_carrier(carrier_company.id, _message()) == 1

    assert sent[0][0] == FCM
    assert '"title": "Nueva orden para cotizar"' in sent[0][1]
    row = db.session.get(CarrierPushSubscription, row.id)
    assert row.last_sent_at is not None and row.failure_count == 0


def test_a_gone_subscription_is_deleted(app, carrier_company, sent):
    _subscription(carrier_company.id)
    sent.reply = (410, 'Push failed: 410 Gone')

    carrier_push.notify_carrier(carrier_company.id, _message())

    assert CarrierPushSubscription.query.count() == 0


def test_other_failures_are_counted_until_the_limit(app, carrier_company, sent):
    row = _subscription(carrier_company.id)
    sent.reply = (500, 'Push failed: 500')

    carrier_push.notify_carrier(carrier_company.id, _message())
    row = db.session.get(CarrierPushSubscription, row.id)
    assert (row.failure_count, row.last_error) == (1, '500 Push failed: 500')

    row.failure_count = carrier_push.MAX_FAILURES - 1
    db.session.commit()
    carrier_push.notify_carrier(carrier_company.id, _message())
    assert CarrierPushSubscription.query.count() == 0


def test_rows_subscribed_with_another_key_are_not_pushed(app, carrier_company, sent):
    # Una base copiada de otro entorno no le escribe a esos celulares.
    _subscription(carrier_company.id, key=OTHER_PUBLIC)
    assert carrier_push.notify_carrier(carrier_company.id, _message()) == 0
    assert sent == []


def test_nothing_is_pushed_while_push_is_off(app, carrier_company, sent, monkeypatch):
    _subscription(carrier_company.id)
    monkeypatch.delenv('WEB_PUSH_PRIVATE_KEY')
    assert carrier_push.notify_carrier(carrier_company.id, _message()) == 0
    assert sent == []


def test_order_summary_fits_a_notification(app, customer):
    order = Order(customer_id=customer.id, appointment_date=datetime(2026, 11, 28, 9), load_type='cargo')
    db.session.add(order)
    db.session.commit()
    db.session.add_all([
        OrderDetails(order_id=order.id, type='carry_from', street='Av. Larco 123, Miraflores 15074, Perú'),
        OrderDetails(order_id=order.id, type='deliver_to', street='Jr. X 1', neighborhood='Santiago de Surco'),
    ])
    db.session.commit()

    assert carrier_push.order_summary(order) == 'sáb 28 nov · Miraflores → Santiago de Surco · Carga o materiales'


def test_a_broken_summary_still_gives_a_message(app, customer, monkeypatch):
    order = Order(customer_id=customer.id)
    db.session.add(order)
    db.session.commit()
    monkeypatch.setattr(carrier_push, '_district', lambda *a: 1 / 0)

    message = carrier_push.new_order_message(order, 'https://chalan.pe/quotation/t')

    assert message['body'] == 'Toca para cotizar.'
    assert message['url'] == 'https://chalan.pe/quotation/t?r=push'


# --- Cuándo sale -----------------------------------------------------------------

def _set_origin(order_id, street):
    detail = OrderDetails.query.filter_by(order_id=order_id, type='carry_from').first()
    detail.street = street
    db.session.commit()


def test_a_new_order_pushes_to_subscribed_carriers(client, customer, carrier_company, monkeypatch, sent):
    monkeypatch.setenv('COUNTRY_ID', '2')
    monkeypatch.setenv('SITE_URL', 'https://chalan.pe/')
    monkeypatch.setattr('app.api.orders.send_email', lambda *a, **k: None)
    carrier_company.country_id = 2
    carrier_company.email = 'carrier@example.com'
    db.session.commit()
    _offers_moving(carrier_company)
    _subscription(carrier_company.id)
    order_id = _create_order(client, customer)
    _make_belongings_complete(order_id)
    _set_origin(order_id, 'Av. Javier Prado 123, San Isidro 15036, Perú')

    send_email_to_carrier_companies(order_id, {'requestQuotationFromCarrierCompany': True})

    assert len(sent) == 1
    payload = sent[0][1]
    assert f'"title": "Nueva orden {order_id} para cotizar"' in payload
    assert 'jue 20 ago · San Isidro · Mudanza. Toca para cotizar.' in payload
    assert '"url": "https://chalan.pe/quotation/' in payload and '?r=push"' in payload
    assert f'"tag": "order-{order_id}"' in payload


def test_a_changed_order_says_so(client, customer, carrier_company, monkeypatch, sent):
    monkeypatch.setenv('COUNTRY_ID', '2')
    monkeypatch.setenv('SITE_URL', 'https://chalan.pe/')
    monkeypatch.setattr('app.api.orders.send_email', lambda *a, **k: None)
    carrier_company.country_id = 2
    db.session.commit()
    _offers_moving(carrier_company)
    _subscription(carrier_company.id)
    order_id = _create_order(client, customer)
    _make_belongings_complete(order_id)
    db.session.add(Quotations(order_id=order_id, carrier_company_id=carrier_company.id, amount=300,
                              quotation_status_id=3))
    db.session.commit()

    send_email_to_carrier_companies(order_id, {'requestQuotationFromCarrierCompany': True})

    assert f'"title": "La orden {order_id} cambió"' in sent[0][1]
    assert 'Vuelve a cotizar.' in sent[0][1]


def test_being_chosen_pushes_to_the_carrier(client, customer, carrier_company, monkeypatch, sent):
    _checkout_setup(monkeypatch, carrier_company, required=False)
    order_id = _order_with_selected_quotation(client, customer, carrier_company)
    _subscription(carrier_company.id)

    assert _checkout(client, customer, order_id).status_code == 200

    assert len(sent) == 1
    assert f'"title": "¡Te eligieron! Orden {order_id}"' in sent[0][1]
    assert '"url": "https://chalan.pe/carrier-company/orders/' in sent[0][1]
    assert '?r=push"' in sent[0][1]
