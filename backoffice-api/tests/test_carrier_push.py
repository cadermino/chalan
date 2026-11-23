"""Avisos push desde el link del transportista de servicios: el backoffice-api
valida el link y reenvía al API principal (app/api/carrier_push.py)."""
import pytest

from tests.test_service_requests import (FakeResponse, carrier_token, make_carrier,  # noqa: F401
                                         materials, packing, submitted)

SUBSCRIPTION = {'endpoint': 'https://fcm.googleapis.com/fcm/send/abc',
                'keys': {'p256dh': 'B' + 'x' * 86, 'auth': 'y' * 22}}


@pytest.fixture
def main_api(monkeypatch):
    seen = []

    class Main:
        reply = FakeResponse(201, {'subscribed': True})

    def fake_request(method, url, json, headers, timeout):
        seen.append({'method': method, 'url': url, 'json': json, 'headers': headers})
        return Main.reply
    monkeypatch.setattr('app.api.service_requests.requests.request', fake_request)
    monkeypatch.setenv('INTERNAL_API_URL', 'http://flask-api:8001')
    Main.seen = seen
    return Main


def test_the_link_forwards_the_subscription_with_its_own_token(client, submitted, main_api):
    carrier = make_carrier(name='Embalajes SAC')
    token = carrier_token(submitted.id, carrier.id)

    res = client.post(f'/api/public/service-requests/{token}/push-subscription',
                      json={**SUBSCRIPTION, 'carrier_company_id': 999},
                      headers={'User-Agent': 'Mozilla/5.0 (Android)'})

    assert (res.status_code, res.get_json()) == (201, {'subscribed': True})
    sent = main_api.seen[0]
    assert sent['url'] == 'http://flask-api:8001/api/v1/carrier-push-subscriptions'
    # La empresa la dice el token, que va tal cual; nada del cuerpo más que el buzón.
    assert sent['headers'] == {'Authorization': f'Bearer {token}', 'User-Agent': 'Mozilla/5.0 (Android)'}
    assert sent['json'] == SUBSCRIPTION


def test_a_bad_or_expired_link_never_reaches_the_main_api(client, submitted, main_api):
    assert client.post('/api/public/service-requests/garbage/push-subscription', json=SUBSCRIPTION).status_code == 404
    from datetime import datetime, timedelta, timezone
    expired = carrier_token(submitted.id, 1, exp=datetime.now(timezone.utc) - timedelta(days=1))
    assert client.post(f'/api/public/service-requests/{expired}/push-subscription',
                       json=SUBSCRIPTION).status_code == 410
    assert main_api.seen == []


def test_main_api_errors_never_become_a_401(client, submitted, main_api):
    token = carrier_token(submitted.id, 1)
    main_api.reply = FakeResponse(400, {'message': 'unsupported_push_service'})
    res = client.post(f'/api/public/service-requests/{token}/push-subscription', json=SUBSCRIPTION)
    assert (res.status_code, res.get_json()['message']) == (400, 'unsupported_push_service')

    main_api.reply = FakeResponse(401, {'message': 'Missing token'})
    assert client.post(f'/api/public/service-requests/{token}/push-subscription', json=SUBSCRIPTION).status_code == 502


def test_public_key_comes_from_the_main_api(client, main_api):
    main_api.reply = FakeResponse(200, {'public_key': 'BKEY'})
    assert client.get('/api/public/web-push/public-key').get_json() == {'public_key': 'BKEY'}
    assert main_api.seen[0]['url'] == 'http://flask-api:8001/api/v1/web-push/public-key'

    main_api.reply = FakeResponse(500, {})
    assert client.get('/api/public/web-push/public-key').get_json() == {'public_key': None}
