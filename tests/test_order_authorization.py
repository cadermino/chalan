"""Quién puede tocar una orden y quién puede adjudicarla.

Estas rutas salen a internet por `location /api` del nginx, aunque un
comentario del código sostenía lo contrario. Cada prueba de acá cubre algo que
antes se podía hacer sin credenciales: reasignar una orden ajena, adjudicarla a
un transportista, o elegir la cotización de la orden de otro.

Las pruebas van contra la ruta HTTP y no contra OrderEntity, que es justamente
el atajo por el que los tests existentes no veían la capa de autorización.
"""
import pytest

from app import db
from app.api.decorators import generate_internal_token
from app.models import Customer, LuServices, Order, Quotations

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


@pytest.fixture
def other_customer(app):
    other = Customer(name='Mallqui', paternal_last_name='Rojas', email='mallqui@example.com')
    db.session.add(other)
    db.session.commit()
    return other


def _auth(customer):
    return {'Authorization': f'Bearer {customer.generate_auth_token(3600)}'}


def _internal_auth():
    return {'Authorization': f'Bearer {generate_internal_token()}'}


def _update_payload(claimed_customer_id):
    """Cuerpo de PUT /order/<id>, con el customer_id que el atacante quiera."""
    return {
        'customer': {'customer_id': claimed_customer_id},
        'order': {
            # Va nula a propósito. La ruta escribe appointment_date como el
            # string crudo que venga en el JSON, y SQLite —el motor de estas
            # pruebas— solo acepta datetime de Python; Postgres lo parsea y por
            # eso en producción no se nota. La misma razón por la que
            # test_orders.py maneja este campo por el ORM en vez de por la
            # ruta. Acá lo que se prueba es quién puede escribir, no qué.
            'appointment_date': None,
            'comments': '1 sofa, 3 cajas',
            'approximate_budget': 500,
        },
        'orderDetailsOrigin': ORIGIN,
        'orderDetailsDestination': DESTINATION,
        'services': {'cargo': '0', 'packaging': '0'},
    }


def _create_order(client, customer_id=None):
    res = client.post('/api/v1/order', json={
        'customer': {'customer_id': customer_id},
        'orderDetailsOrigin': ORIGIN,
        'orderDetailsDestination': DESTINATION,
    })
    return res.get_json()['order_id']


# --- PUT /order/<id> ---------------------------------------------------------

def test_update_order_without_token_is_rejected(client, customer, other_customer):
    order_id = _create_order(client, customer.id)

    res = client.put(f'/api/v1/order/{order_id}', json=_update_payload(other_customer.id))

    assert res.status_code == 403
    assert db.session.get(Order, order_id).customer_id == customer.id


def test_update_order_with_another_customers_token_is_rejected(client, customer, other_customer):
    order_id = _create_order(client, customer.id)

    res = client.put(
        f'/api/v1/order/{order_id}',
        json=_update_payload(other_customer.id),
        headers=_auth(other_customer),
    )

    assert res.status_code == 403
    assert db.session.get(Order, order_id).customer_id == customer.id


def test_owner_can_update_but_the_body_cannot_reassign_the_order(client, customer, other_customer):
    # El dueño sí edita; lo que no se acepta es el customer_id del cuerpo, que
    # es lo que permitía regalarle la orden —y los datos del cliente— a otro.
    order_id = _create_order(client, customer.id)

    res = client.put(
        f'/api/v1/order/{order_id}',
        json=_update_payload(other_customer.id),
        headers=_auth(customer),
    )

    assert res.status_code == 200
    assert db.session.get(Order, order_id).customer_id == customer.id


def test_anonymous_can_still_edit_an_order_with_no_owner(client, other_customer):
    # El paso 1 del formulario ocurre antes de que el visitante se registre, así
    # que una orden sin dueño tiene que seguir siendo editable sin sesión.
    order_id = _create_order(client)

    res = client.put(f'/api/v1/order/{order_id}', json=_update_payload(other_customer.id))

    assert res.status_code == 200
    assert db.session.get(Order, order_id).customer_id is None


def test_logging_in_links_the_order_to_the_token_customer(client, customer, other_customer):
    # Es lo que hace Login.vue al volver del registro: la orden queda ligada a
    # quien tiene la sesión, no a quien diga el cuerpo.
    order_id = _create_order(client)

    res = client.put(
        f'/api/v1/order/{order_id}',
        json=_update_payload(other_customer.id),
        headers=_auth(customer),
    )

    assert res.status_code == 200
    assert db.session.get(Order, order_id).customer_id == customer.id


def test_update_missing_order_returns_404(client, customer):
    res = client.put('/api/v1/order/999999', json=_update_payload(customer.id),
                     headers=_auth(customer))

    assert res.status_code == 404


# --- adjudicar una orden -----------------------------------------------------

@pytest.fixture
def quoted_order(app, client, customer, carrier_company):
    order_id = _create_order(client, customer.id)
    quotation = Quotations(order_id=order_id, carrier_company_id=carrier_company.id, amount=450)
    db.session.add(quotation)
    db.session.commit()
    return order_id, quotation.id


def test_accepting_a_quotation_without_credentials_is_rejected(client, quoted_order):
    order_id, quotation_id = quoted_order

    res = client.patch(f'/api/v1/order/{order_id}/quotation/{quotation_id}/accept')

    assert res.status_code == 403
    assert db.session.get(Quotations, quotation_id).quotation_status_id == 1


def test_another_customer_cannot_accept_a_quotation(client, quoted_order, other_customer):
    order_id, quotation_id = quoted_order

    res = client.patch(
        f'/api/v1/order/{order_id}/quotation/{quotation_id}/accept',
        headers=_auth(other_customer),
    )

    assert res.status_code == 403
    assert db.session.get(Quotations, quotation_id).quotation_status_id == 1


def test_backoffice_can_accept_with_an_internal_token(client, quoted_order, monkeypatch):
    # El backoffice llama server-to-server: ya validó el rol de su lado.
    monkeypatch.setenv('PLATFORM_FEE', '0.1')
    order_id, quotation_id = quoted_order

    res = client.patch(
        f'/api/v1/order/{order_id}/quotation/{quotation_id}/accept',
        headers=_internal_auth(),
    )

    assert res.status_code == 200
    assert db.session.get(Quotations, quotation_id).quotation_status_id == 2


# --- elegir cotización (cliente) ---------------------------------------------

def test_customer_cannot_pick_a_quotation_on_someone_elses_order(
        client, quoted_order, other_customer):
    # Antes alcanzaba con tener sesión: el token se verificaba y se descartaba.
    _, quotation_id = quoted_order

    res = client.put(f'/api/v1/quotation/{quotation_id}', headers=_auth(other_customer))

    assert res.status_code == 403
    assert db.session.get(Quotations, quotation_id).quotation_status_id == 1


def test_owner_can_pick_their_own_quotation(client, quoted_order, customer, monkeypatch):
    monkeypatch.setenv('PLATFORM_FEE', '0.1')
    _, quotation_id = quoted_order

    res = client.put(f'/api/v1/quotation/{quotation_id}', headers=_auth(customer))

    assert res.status_code == 200
    assert db.session.get(Quotations, quotation_id).quotation_status_id == 2
