"""Avisos push de solicitudes de servicio (app/api/carrier_push.py) y qué
tokens pueden suscribir un navegador."""
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app import db
from app.api import carrier_push
from app.api.service_request.notifications import generate_service_request_token
from app.models import CarrierPushSubscription, ServiceRequest

from test_service_requests import (catalog, lima_clock, sent, choose, make_carrier, make_submitted,  # noqa: F401
                                   submitted_with_quote)

PUBLIC = 'B' + 'A' * 86
SUBSCRIPTION = {'endpoint': 'https://fcm.googleapis.com/fcm/send/abc',
                'keys': {'p256dh': 'B' + 'x' * 86, 'auth': 'y' * 22}}


@pytest.fixture(autouse=True)
def push_keys(monkeypatch):
    monkeypatch.setenv('WEB_PUSH_PUBLIC_KEY', PUBLIC)
    monkeypatch.setenv('WEB_PUSH_PRIVATE_KEY', 'private-key-for-tests')


@pytest.fixture
def pushed(monkeypatch):
    calls = []
    monkeypatch.setattr(carrier_push, '_send', lambda info, payload: calls.append(payload) or (201, None))
    return calls


def _jwt(app, **payload):
    now = datetime.now(timezone.utc)
    return jwt.encode({'iat': now, 'exp': now + timedelta(days=1), **payload},
                      app.config['SECRET_KEY'], algorithm='HS256')


def _subscribe(client, token):
    return client.post('/api/v1/carrier-push-subscriptions', json=SUBSCRIPTION,
                       headers={'Authorization': f'Bearer {token}'})


def _subscription(company_id):
    db.session.add(CarrierPushSubscription(carrier_company_id=company_id, endpoint=SUBSCRIPTION['endpoint'],
                                           p256dh=SUBSCRIPTION['keys']['p256dh'],
                                           auth=SUBSCRIPTION['keys']['auth'], vapid_public_key=PUBLIC))
    db.session.commit()


# --- Qué token suscribe ----------------------------------------------------------

def test_a_service_link_subscribes_its_company(app, client):
    carrier = make_carrier()
    token = generate_service_request_token(1, carrier.id)

    assert _subscribe(client, token).status_code == 201
    assert CarrierPushSubscription.query.one().carrier_company_id == carrier.id


@pytest.mark.parametrize('payload', [
    # Reseña de un servicio y de una mudanza: los tiene el cliente.
    {'purpose': 'review', 'service_request_id': 1, 'carrier_company_id': 1},
    {'purpose': 'review', 'order_id': 1, 'customer_id': 1, 'carrier_company_id': 1},
    # Reseña de mudanza de antes de octubre de 2026, sin propósito.
    {'order_id': 1, 'customer_id': 1, 'carrier_company_id': 1},
    # Un propósito desconocido, o el de servicio sin solicitud.
    {'purpose': 'other', 'order_id': 1, 'carrier_company_id': 1},
    {'purpose': 'service_request', 'carrier_company_id': 1},
])
def test_tokens_customers_hold_cannot_subscribe(app, client, payload):
    make_carrier()
    res = _subscribe(client, _jwt(app, **payload))
    assert (res.status_code, res.get_json()['message']) == (400, 'Invalid token')
    assert CarrierPushSubscription.query.count() == 0


# --- Cuándo sale -------------------------------------------------------------------

def test_a_new_request_pushes_to_subscribed_carriers(app, client, pushed):
    carrier = make_carrier()
    _subscription(carrier.id)

    request_id = make_submitted(client)

    assert len(pushed) == 1
    assert '"title": "Nueva solicitud de embalaje"' in pushed[0]
    assert 'mar 6 oct · ' in pushed[0] and 'Toca para cotizar.' in pushed[0]
    assert '"url": "https://chalan.pe/backoffice/carrier-view/' in pushed[0] and '?r=push"' in pushed[0]
    assert f'"tag": "service-{request_id}"' in pushed[0]


def test_being_chosen_for_a_service_pushes_to_the_carrier(app, client, pushed):
    service_request, carrier, quotation_id = submitted_with_quote(client)
    _subscription(carrier.id)
    pushed.clear()

    assert choose(client, service_request.public_id, quotation_id).status_code == 200

    assert len(pushed) == 1
    assert '"title": "¡Te eligieron! Embalaje"' in pushed[0]
    assert 'Toca para ver los datos del cliente.' in pushed[0]
    assert '"url": "https://chalan.pe/backoffice/carrier-view/' in pushed[0]


def test_a_request_without_date_or_address_still_gives_a_message(app):
    request = ServiceRequest(id=5)
    message = carrier_push.new_service_message(request, 'https://chalan.pe/backoffice/carrier-view/t')
    assert message == {'title': 'Nueva solicitud de servicio', 'body': 'Toca para cotizar.',
                       'url': 'https://chalan.pe/backoffice/carrier-view/t?r=push', 'tag': 'service-5'}
