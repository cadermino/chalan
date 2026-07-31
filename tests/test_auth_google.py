from unittest.mock import patch

from app import db
from app.models import Customer


def _mock_idinfo(**overrides):
    idinfo = {'email': 'nueva@example.com', 'name': 'Nueva Cliente'}
    idinfo.update(overrides)
    return idinfo


def test_creates_a_new_customer_on_first_google_login(client):
    with patch('google.oauth2.id_token.verify_oauth2_token', return_value=_mock_idinfo()):
        res = client.post('/api/auth/login-google', json={'credential': 'fake-token'})

    assert res.status_code == 200
    body = res.get_json()
    assert body['email'] == 'nueva@example.com'
    assert body['name'] == 'Nueva Cliente'
    assert body['token']

    customer = Customer.query.filter_by(email='nueva@example.com').first()
    assert customer is not None


def test_logs_in_existing_customer_without_creating_a_duplicate(app, client):
    existing = Customer(name='Ya Existo', email='repetida@example.com')
    db.session.add(existing)
    db.session.commit()

    with patch('google.oauth2.id_token.verify_oauth2_token', return_value=_mock_idinfo(email='repetida@example.com')):
        res = client.post('/api/auth/login-google', json={'credential': 'fake-token'})

    assert res.status_code == 200
    assert res.get_json()['name'] == 'Ya Existo'
    assert Customer.query.filter_by(email='repetida@example.com').count() == 1


def test_email_lookup_is_case_insensitive(app, client):
    existing = Customer(name='Case Test', email='mixedcase@example.com')
    db.session.add(existing)
    db.session.commit()

    with patch('google.oauth2.id_token.verify_oauth2_token', return_value=_mock_idinfo(email='MixedCase@Example.com')):
        res = client.post('/api/auth/login-google', json={'credential': 'fake-token'})

    assert res.status_code == 200
    assert Customer.query.filter_by(email='mixedcase@example.com').count() == 1


def test_missing_credential_is_rejected(client):
    res = client.post('/api/auth/login-google', json={})
    assert res.status_code == 400


def test_invalid_google_token_is_rejected(client):
    with patch('google.oauth2.id_token.verify_oauth2_token', side_effect=ValueError('bad token')):
        res = client.post('/api/auth/login-google', json={'credential': 'not-a-real-token'})

    assert res.status_code == 403


def test_google_response_without_email_is_rejected(client):
    with patch('google.oauth2.id_token.verify_oauth2_token', return_value={'name': 'Sin Email'}):
        res = client.post('/api/auth/login-google', json={'credential': 'fake-token'})

    assert res.status_code == 400
