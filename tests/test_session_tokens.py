"""Las sesiones de cliente no se confunden con otros tokens.

Las dos APIs firman con el mismo SECRET_KEY: sin un tipo en el token, la sesión
de un usuario del backoffice con id N entraba aquí como el cliente N, y un link
de transportista usado como sesión daba 500.
"""
from datetime import datetime, timedelta, timezone

import jwt


def _sign(app, payload):
    payload = {'exp': datetime.now(timezone.utc) + timedelta(hours=1), **payload}
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')


def _last_pending_order(client, customer, token):
    return client.get(f'/api/v1/customer/{customer.id}/last-pending-order',
                      headers={'Authorization': f'Bearer {token}'})


def test_a_backoffice_session_is_not_a_customer_session(app, client, customer):
    for payload in (
        {'typ': 'backoffice', 'id': customer.id, 'role': 'superadmin', 'carrier_company_id': None},
        # Las del backoffice de antes del tipo.
        {'id': customer.id, 'role': 'real_estate_agent', 'carrier_company_id': None},
    ):
        res = _last_pending_order(client, customer, _sign(app, payload))
        assert res.status_code != 200, payload


def test_a_customer_session_from_before_the_type_still_works(app, client, customer):
    token = _sign(app, {'id': customer.id, 'iat': datetime.now(timezone.utc)})

    assert _last_pending_order(client, customer, token).status_code == 200


def test_a_carrier_link_used_as_a_session_is_refused_not_a_500(app, client, customer, carrier_company):
    token = _sign(app, {'carrier_company_id': carrier_company.id, 'order_id': 1,
                        'iat': datetime.now(timezone.utc)})

    assert _last_pending_order(client, customer, token).status_code == 400


def test_nobody_can_ask_for_a_carrier_link(client, order, carrier_company):
    res = client.post('/api/auth/generate-carrier-company-token',
                      json={'order_id': order.id, 'carrier_company_id': carrier_company.id})

    assert res.status_code in (404, 405)
