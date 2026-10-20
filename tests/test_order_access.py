"""Link de acceso a una orden: abre las cotizaciones sin contraseña.

El aviso de "nueva cotización" lleva un token con la orden y su cliente; el API
lo canjea por la misma sesión que da el login. También se prueba que el
backoffice pueda crear clientes sin contraseña y que esos clientes no rompan
el login.
"""
import pytest

from app import db
from app.api import order_access
from app.api.carrier_company import CarrierCompany as CarrierCompanyEntity
from app.api.decorators import generate_internal_token
from app.models import Customer, Order


def access(client, token):
    return client.post('/api/auth/order-access', json={'token': token})


def test_the_link_opens_a_session_for_the_customer_of_the_order(app, client, order, customer):
    res = access(client, order_access.make_token(order))

    assert res.status_code == 200
    body = res.get_json()
    assert body['order_id'] == order.id
    assert body['email'] == customer.email
    assert Customer.verify_auth_token(body['token']).id == customer.id


def test_the_url_points_to_the_vue_route(app, order, monkeypatch):
    monkeypatch.setenv('SITE_URL', 'https://chalan.pe/')
    url = order_access.order_access_url(order)
    assert url.startswith('https://chalan.pe/acceso/')
    # Va dentro de un WhatsApp: tiene que seguir siendo corto.
    assert len(url) < 90


def test_an_expired_link_says_so(app, client, order, monkeypatch):
    token = order_access.make_token(order)
    monkeypatch.setattr(order_access, 'MAX_AGE', -1)

    res = access(client, token)

    assert res.status_code == 401
    assert res.get_json()['reason'] == 'expired'


@pytest.mark.parametrize('token', ['nada', 'WzEsMV0.abc.def', ''])
def test_a_made_up_link_is_rejected(client, token):
    res = access(client, token)
    assert res.status_code in (400, 401)


def test_a_tampered_link_is_rejected(app, client, order):
    token = order_access.make_token(order)
    res = access(client, token[:-2] + ('AA' if not token.endswith('AA') else 'BB'))
    assert res.status_code == 401 and res.get_json()['reason'] == 'invalid'


def test_a_link_from_another_app_secret_is_rejected(app, client, order):
    from itsdangerous import URLSafeTimedSerializer
    forged = URLSafeTimedSerializer('otra-clave', salt=order_access.SALT).dumps([order.id, order.customer_id])
    assert access(client, forged).status_code == 401


def test_the_link_stops_working_if_the_order_changes_owner(app, client, order):
    token = order_access.make_token(order)
    other = Customer(name='Otra', email='otra@example.com')
    db.session.add(other)
    db.session.commit()
    order.customer_id = other.id
    db.session.commit()

    res = access(client, token)

    assert res.status_code == 401 and res.get_json()['reason'] == 'invalid'


def test_an_order_without_customer_has_no_link(app, client):
    order = Order()
    db.session.add(order)
    db.session.commit()
    assert access(client, order_access.make_token(order)).status_code == 401


def test_a_missing_order_is_rejected(app, client, order):
    token = order_access.make_token(order)
    db.session.delete(order)
    db.session.commit()
    assert access(client, token).status_code == 401


# --- el aviso de nueva cotización ------------------------------------------------

def test_the_new_quotation_notice_carries_the_link(app, client, order, carrier_company, monkeypatch):
    sent = {}
    monkeypatch.setenv('SITE_URL', 'https://chalan.pe/')
    monkeypatch.setattr('app.api.quotations.send_email',
                        lambda *a, **kw: sent.setdefault('email', kw['step_three_url']))
    monkeypatch.setattr('app.api.quotations.send_whatsapp',
                        lambda phone, sid, variables, **kw: sent.setdefault('whatsapp', variables['1']))
    token = CarrierCompanyEntity().generate_carrier_company_token(3600, order.id, carrier_company.id)

    res = client.post('/api/v1/quotations', json={'amount': 500},
                      headers={'Authorization': f'Bearer {token}'})

    assert res.status_code == 201
    assert sent['whatsapp'] == sent['email']
    assert sent['whatsapp'].startswith('https://chalan.pe/acceso/')
    link_token = sent['whatsapp'].rsplit('/', 1)[1]
    assert access(client, link_token).get_json()['order_id'] == order.id


# --- clientes sin contraseña -----------------------------------------------------

def _register(client, headers=None, **fields):
    payload = {'name': 'Rosa', 'email': 'rosa@example.com', 'mobile_phone': '+51987654321', **fields}
    return client.post('/api/auth/register', json=payload, headers=headers or {})


def test_the_backoffice_can_create_a_customer_without_password(client):
    res = _register(client, headers={'Authorization': f'Bearer {generate_internal_token()}'})

    assert res.status_code == 201
    assert Customer.query.filter_by(email='rosa@example.com').one().password_hash is None


def test_the_site_still_requires_a_password(client):
    assert _register(client).status_code == 400


def test_logging_in_to_a_customer_without_password_fails_cleanly(client):
    _register(client, headers={'Authorization': f'Bearer {generate_internal_token()}'})

    res = client.post('/api/auth/login', json={'email': 'rosa@example.com', 'password': 'loquesea'})

    assert res.status_code == 400
