"""Las sesiones del backoffice no se confunden con las de cliente.

Las dos APIs firman con el mismo SECRET_KEY: sin un tipo en el token, la sesión
de un cliente con id N entraba aquí como el usuario N (un superadmin, si el id
coincidía). Y desactivar a alguien no cortaba su sesión abierta.
"""
from datetime import datetime, timedelta, timezone

import jwt

from app import db
from app.models import AdminUser
from tests.test_service_requests import SECRET, make_user


def _sign(payload):
    payload = {'exp': datetime.now(timezone.utc) + timedelta(hours=1), **payload}
    return jwt.encode(payload, SECRET, algorithm='HS256')


def _me(client, token):
    return client.get('/auth/me', headers={'Authorization': f'Bearer {token}'})


def test_a_customer_session_is_not_a_backoffice_session(client, app):
    make_user('superadmin')
    user = AdminUser.query.filter_by(role='superadmin').one()

    for payload in (
        {'typ': 'customer', 'id': user.id, 'iat': datetime.now(timezone.utc)},
        # Las de cliente de antes del tipo.
        {'id': user.id, 'iat': datetime.now(timezone.utc)},
    ):
        assert _me(client, _sign(payload)).status_code == 401, payload
        res = client.get('/api/users', headers={'Authorization': f'Bearer {_sign(payload)}'})
        assert res.status_code == 401, payload


def test_a_backoffice_session_opens_the_backoffice(client, app):
    headers = make_user('admin')

    res = client.get('/auth/me', headers=headers)

    assert res.status_code == 200
    assert res.get_json()['user']['role'] == 'admin'


def test_a_backoffice_session_from_before_the_type_still_works(client, app):
    make_user('admin')
    user = AdminUser.query.filter_by(role='admin').one()
    token = _sign({'id': user.id, 'role': user.role, 'carrier_company_id': None})

    assert _me(client, token).status_code == 200


def test_deactivating_a_user_closes_their_open_session(client, app):
    headers = make_user('carrier_company')
    user = AdminUser.query.filter_by(role='carrier_company').one()
    user.active = 0
    db.session.commit()

    assert client.get('/auth/me', headers=headers).status_code == 401
