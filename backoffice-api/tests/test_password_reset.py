"""Recuperar la contraseña del backoffice.

Lo que se prueba es lo que dejaría entrar a otro o dejaría afuera al dueño:
que la respuesta no diga si el correo tiene cuenta, que el link sea de un solo
uso y venza, que no sirva para un usuario inactivo, que no se puedan mandar
correos sin freno y que solo un superadmin copie el link de 24 horas.
"""
import time
from datetime import datetime, timedelta

import pytest
from itsdangerous.timed import TimestampSigner

from app import db, password_reset
from app.models import AdminUser
from tests.test_service_requests import make_user


@pytest.fixture
def sent(monkeypatch):
    emails = []
    monkeypatch.setattr('app.auth.routes.send_email',
                        lambda to, subject, template, **kw: emails.append({'to': to, **kw}))
    return emails


@pytest.fixture
def carrier(app):
    make_user('carrier_company', suffix='reset')
    return AdminUser.query.filter_by(email='carrier_company-reset@example.com').one()


def ask(client, email):
    return client.post('/auth/password-reset', json={'email': email})


def confirm(client, token, password='nueva-clave-123'):
    return client.post('/auth/password-reset/confirm', json={'token': token, 'password': password})


def token_from(email):
    return email['reset_url'].rsplit('/', 1)[1]


def test_the_email_link_sets_a_new_password_and_opens_a_session(client, carrier, sent):
    res = ask(client, ' Carrier_Company-Reset@example.com ')

    assert res.status_code == 202
    assert sent[0]['to'] == carrier.email
    assert '/backoffice/restablecer/' in sent[0]['reset_url']
    res = confirm(client, token_from(sent[0]))
    assert res.status_code == 200
    assert AdminUser.verify_auth_token(res.get_json()['token']).id == carrier.id
    assert client.post('/auth/login', json={'email': carrier.email, 'password': 'nueva-clave-123'}).status_code == 200


def test_an_unknown_email_gets_the_same_answer_and_no_email(client, sent):
    res = ask(client, 'nadie@example.com')

    assert res.status_code == 202
    assert res.get_json() == ask(client, 'nadie@example.com').get_json()
    assert sent == []


def test_an_inactive_user_gets_no_email_and_its_links_do_not_work(client, carrier, sent):
    token = password_reset.make_token(carrier)
    carrier.active = 0
    db.session.commit()

    ask(client, carrier.email)

    assert sent == []
    assert confirm(client, token).get_json()['reason'] == 'invalid'


def test_the_link_works_once(client, carrier, sent):
    ask(client, carrier.email)
    token = token_from(sent[0])

    assert confirm(client, token).status_code == 200
    res = confirm(client, token, 'otra-clave-456')
    assert res.status_code == 401
    assert res.get_json()['reason'] == 'used'


def test_a_new_request_within_two_minutes_sends_nothing(client, carrier, sent):
    ask(client, carrier.email)
    ask(client, carrier.email)
    assert len(sent) == 1

    carrier.password_reset_requested_at = datetime.utcnow() - timedelta(minutes=3)
    db.session.commit()
    ask(client, carrier.email)
    assert len(sent) == 2


@pytest.mark.parametrize('via, hours, reason', [
    (password_reset.EMAIL, 0.5, None),
    (password_reset.EMAIL, 2, 'expired'),
    (password_reset.ADMIN_LINK, 20, None),
    (password_reset.ADMIN_LINK, 25, 'expired'),
])
def test_email_links_last_an_hour_and_admin_links_a_day(carrier, monkeypatch, via, hours, reason):
    # Firmado hace `hours` horas.
    signed_at = int(time.time() - hours * 3600)
    with monkeypatch.context() as m:
        m.setattr(TimestampSigner, 'get_timestamp', lambda self: signed_at)
        token = password_reset.make_token(carrier, via=via)

    user, problem = password_reset.read_token(token)

    assert problem == reason
    assert (user is not None) == (reason is None)


@pytest.mark.parametrize('token', ['', 'nada', 'WzEsImFiYyIsImUiXQ.abc.def'])
def test_a_made_up_link_is_rejected(client, token):
    res = confirm(client, token)
    assert res.status_code == 401
    assert res.get_json()['reason'] == 'invalid'


def test_a_short_password_is_rejected_and_the_link_still_works(client, carrier):
    token = password_reset.make_token(carrier)

    assert confirm(client, token, 'corta').status_code == 400
    assert confirm(client, token).status_code == 200


def test_only_a_superadmin_copies_the_whatsapp_link(client, carrier):
    superadmin = make_user('superadmin')
    admin = make_user('admin')

    res = client.get(f'/api/users/{carrier.id}/password-reset-link', headers=superadmin)
    assert res.status_code == 200
    user, problem = password_reset.read_token(res.get_json()['token'])
    assert (user.id, problem) == (carrier.id, None)
    assert client.get(f'/api/users/{carrier.id}/password-reset-link', headers=admin).status_code == 403
