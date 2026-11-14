"""Quién puede tocar una orden y quién puede adjudicarla.

Estas rutas salen a internet por `location /api` del nginx, aunque un
comentario del código sostenía lo contrario. Cada prueba de acá cubre algo que
antes se podía hacer sin credenciales: reasignar una orden ajena, adjudicarla a
un transportista, o elegir la cotización de la orden de otro.

Las pruebas van contra la ruta HTTP y no contra OrderEntity, que es justamente
el atajo por el que los tests existentes no veían la capa de autorización.
"""
import io

import pytest

from app import db
from app.api.decorators import generate_internal_token
from app.models import Customer, LuServices, Order, OrderImage, Quotations

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
    # Con la sesión del dueño, como Vue: el API no le cree al customer_id del cuerpo.
    headers = _auth(db.session.get(Customer, customer_id)) if customer_id else {}
    res = client.post('/api/v1/order', json={
        'customer': {'customer_id': customer_id},
        'orderDetailsOrigin': ORIGIN,
        'orderDetailsDestination': DESTINATION,
    }, headers=headers)
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


# --- auditoría de seguridad: lo que se podía tocar de una orden ajena -------

def test_a_new_order_does_not_take_its_owner_from_the_body(client, customer, other_customer):
    # Cualquiera creaba órdenes a nombre de otro cliente: pasaban a ser "su
    # último pedido" y le traían avisos de una mudanza que no pidió.
    anonymous = _create_order_as(client, customer.id, headers={})
    as_other = _create_order_as(client, customer.id, headers=_auth(other_customer))
    own = _create_order_as(client, customer.id, headers=_auth(customer))
    from_backoffice = _create_order_as(client, customer.id, headers=_internal_auth())

    assert db.session.get(Order, anonymous).customer_id is None
    assert db.session.get(Order, as_other).customer_id is None
    assert db.session.get(Order, own).customer_id == customer.id
    assert db.session.get(Order, from_backoffice).customer_id == customer.id


def _create_order_as(client, customer_id, headers):
    return client.post('/api/v1/order', json={
        'customer': {'customer_id': customer_id},
        'orderDetailsOrigin': ORIGIN,
        'orderDetailsDestination': DESTINATION,
    }, headers=headers).get_json()['order_id']


def test_only_the_owner_changes_the_whatsapp_of_an_order(client, customer, other_customer):
    # "Recordar a clientes" escribe a lead_phone con el link de acceso del
    # cliente: cambiarlo era recibir una sesión del cliente por 60 días.
    order_id = _create_order(client, customer.id)
    url = f'/api/v1/order/{order_id}/lead-phone'

    assert client.put(url, json={'lead_phone': '900000001'}).status_code == 403
    assert client.put(url, json={'lead_phone': '900000002'}, headers=_auth(other_customer)).status_code == 403
    assert db.session.get(Order, order_id).lead_phone is None
    assert client.put(url, json={'lead_phone': '955111222'}, headers=_auth(customer)).status_code == 200
    assert db.session.get(Order, order_id).lead_phone == '955111222'


def test_the_whatsapp_of_an_order_without_an_owner_is_still_open(client):
    # El modal del paso 1 lo pide antes de que haya cuenta.
    order_id = _create_order(client)

    assert client.put(f'/api/v1/order/{order_id}/lead-phone', json={'lead_phone': '955111222'}).status_code == 200


def test_only_the_owner_lists_the_quotations_of_an_order(client, quoted_order, customer, other_customer, monkeypatch):
    # Un transportista registrado como cliente veía los precios de sus
    # competidores en cada orden.
    monkeypatch.setenv('PLATFORM_FEE', '0.1')
    order_id, _ = quoted_order

    assert client.get(f'/api/v1/quotations/{order_id}', headers=_auth(other_customer)).status_code == 403
    assert client.get(f'/api/v1/quotations/{order_id}', headers=_auth(customer)).status_code == 200


def test_photos_of_an_order_with_an_owner_need_their_session(client, customer, other_customer):
    # Cada foto es un archivo público en el bucket y una llamada pagada a OpenAI.
    order_id = _create_order(client, customer.id)

    for headers in ({}, _auth(other_customer)):
        res = client.post('/api/v1/order/recognize-items', headers=headers, content_type='multipart/form-data',
                          data={'order_id': str(order_id), 'image': (io.BytesIO(b'x'), 'a.jpg', 'image/jpeg')})
        assert res.status_code == 403


def test_an_order_takes_at_most_ten_photos(client, customer):
    order_id = _create_order(client, customer.id)
    db.session.add_all([OrderImage(order_id=order_id, url=f'https://b/{n}', storage_key=f'orders/{n}')
                        for n in range(10)])
    db.session.commit()

    res = client.post('/api/v1/order/recognize-items', headers=_auth(customer), content_type='multipart/form-data',
                      data={'order_id': str(order_id), 'image': (io.BytesIO(b'x'), 'a.jpg', 'image/jpeg')})

    assert res.status_code == 409


def test_only_the_backoffice_deletes_a_photo(client, customer):
    # Recorriendo ids se borraban de S3 las fotos de órdenes ajenas.
    order_id = _create_order(client, customer.id)
    image = OrderImage(order_id=order_id, url='https://b/1', storage_key='orders/1')
    db.session.add(image)
    db.session.commit()

    for headers in ({}, _auth(customer)):
        res = client.delete(f'/api/v1/order/{order_id}/image/{image.id}', headers=headers)
        assert res.status_code == 403
    assert db.session.get(OrderImage, image.id) is not None
