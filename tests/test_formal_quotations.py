"""Cotización formal en PDF para clientes con RUC (paso 3 y backoffice)."""
from datetime import date, datetime
from decimal import Decimal

import pytest

from app import db
from app.api.decorators import generate_internal_token
from app.api.formal_quotation.build import amounts, appointment_label, validity
from app.api.formal_quotation.ruc import is_valid_ruc
from app.api.order.order_status import OrderStatus
from app.api.quotation.quotation_status import QuotationStatus
from app.models import (Customer, FormalQuotation, LuServices, Order, OrderDetails, OrdersServices,
                        Payment, Quotations, Vehicle)

RUC = '20510042990'
CLIENT = {'ruc': RUC, 'business_name': 'PMS GESTION INTEGRAL SAC',
          'contact_name': 'Ariadna', 'contact_email': 'compras@example.com'}


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    monkeypatch.setenv('PLATFORM_FEE', '0.1')
    monkeypatch.delenv('YAPE_RESERVATION_REQUIRED', raising=False)
    monkeypatch.delenv('IGV_RATE', raising=False)
    # Datos de ejemplo: los reales están solo en el entorno del servidor.
    monkeypatch.setenv('FORMAL_QUOTATION_BANK_HOLDER', 'Titular Ejemplo')
    monkeypatch.setenv('FORMAL_QUOTATION_BANK_ACCOUNT', '1234567890')
    monkeypatch.setenv('FORMAL_QUOTATION_BANK_CCI', '00212345678901234567')
    monkeypatch.delenv('FORMAL_QUOTATION_BANK_NAME', raising=False)
    monkeypatch.delenv('FORMAL_QUOTATION_YAPE', raising=False)
    monkeypatch.setenv('FORMAL_QUOTATION_SIGNER', 'Firmante Ejemplo')


@pytest.fixture
def emails(monkeypatch):
    sent = []
    monkeypatch.setattr('app.api.formal_quotations.send_email',
                        lambda *args, **kwargs: sent.append((args, kwargs)))
    return sent


@pytest.fixture
def quotation(order, carrier_company):
    db.session.add(Vehicle(carrier_company_id=carrier_company.id, active=1, brand='Hyundai',
                           model='H100', plates='b6b799'))
    order.appointment_date = datetime(2026, 12, 2, 10, 0)
    order.comments = '1 microondas, 5 cajoneras'
    order.loaders_quantity = 2
    db.session.add_all([
        OrderDetails(order_id=order.id, type='carry_from', street='Av. Primavera 939, San Borja 15037',
                     floor_number=4, has_elevator=1, approximate_distance_from_parking=0),
        OrderDetails(order_id=order.id, type='deliver_to', street='Calle García Robles, Surquillo 15038',
                     floor_number=1, has_elevator=0, approximate_distance_from_parking=0),
    ])
    quotation = Quotations(order_id=order.id, carrier_company_id=carrier_company.id, amount=380,
                           quotation_status_id=QuotationStatus.Active())
    db.session.add(quotation)
    db.session.commit()
    return quotation


def _customer_headers(customer):
    return {'Authorization': f'Bearer {customer.generate_auth_token(3600)}'}


def _internal_headers():
    return {'Authorization': f'Bearer {generate_internal_token()}'}


def _post(client, order, headers, **body):
    return client.post(f'/api/v1/order/{order.id}/formal-quotations', json=body, headers=headers)


# --- RUC y cálculos -------------------------------------------------------

@pytest.mark.parametrize('ruc,valid', [
    ('20616033094', True), ('20510042990', True), ('20100821371', True),
    ('20100821372', False),  # dígito verificador
    ('30100821371', False),  # prefijo
    ('2051004299', False), ('205100429901', False), ('2051004299a', False), (None, False),
])
def test_ruc(ruc, valid):
    assert is_valid_ruc(ruc) is valid


def test_igv_goes_on_top_by_default():
    assert amounts(418, False) == (Decimal('418.00'), Decimal('75.24'), Decimal('493.24'))


def test_igv_inside_when_the_price_includes_it():
    subtotal, igv, total = amounts(493.24, True)
    assert (subtotal, igv, total) == (Decimal('418.00'), Decimal('75.24'), Decimal('493.24'))


def test_validity_is_seven_days_or_the_moving_day():
    assert validity(date(2026, 11, 3), datetime(2026, 12, 1, 10))[0] == date(2026, 11, 10)
    until, label = validity(date(2026, 11, 3), datetime(2026, 11, 5, 10))
    assert until == date(2026, 11, 5)
    assert 'día del servicio' in label


def test_appointment_label():
    assert appointment_label(datetime(2026, 11, 3, 10, 0)) == 'Martes 3 de noviembre de 2026, 10:00 a. m.'
    assert appointment_label(datetime(2026, 11, 3, 15, 30)) == 'Martes 3 de noviembre de 2026, 3:30 p. m.'


# --- Cliente (paso 3) -----------------------------------------------------

def test_the_customer_gets_the_pdf_with_igv_on_top(client, customer, order, quotation, emails):
    res = _post(client, order, _customer_headers(customer), quotation_id=quotation.id, **CLIENT)

    assert res.status_code == 200
    assert res.mimetype == 'application/pdf'
    assert res.data.startswith(b'%PDF')
    assert 'Cotizacion_PMS_GESTION_INTEGRAL_SAC_' in res.headers['Content-Disposition']
    row = FormalQuotation.query.one()
    assert (float(row.subtotal), float(row.igv), float(row.total)) == (418.0, 75.24, 493.24)
    assert row.customer_id == customer.id and row.created_by_admin_id is None
    rows = dict(row.document['service_rows'])
    assert rows['Unidad y personal'] == 'Hyundai H100, placa B6B799, con conductor y 2 cargadores.'
    assert rows['Incluye'] == 'Carga en el origen (piso 4), transporte y descarga en el destino (piso 1).'
    assert 'piso adicional al piso 1' in ' '.join(row.document['conditions'][0][1])
    # Al correo que dejó, con el PDF adjunto.
    assert len(emails) == 1
    args, kwargs = emails[0]
    assert args[0] == 'compras@example.com'
    assert kwargs['attachments'][0][1] == 'application/pdf'


def test_asking_again_updates_it_without_another_email(client, customer, order, quotation, emails):
    _post(client, order, _customer_headers(customer), quotation_id=quotation.id, **CLIENT)
    res = _post(client, order, _customer_headers(customer), quotation_id=quotation.id,
                **{**CLIENT, 'contact_name': 'Ariadna Agüero'})

    assert res.status_code == 200
    assert FormalQuotation.query.count() == 1
    assert FormalQuotation.query.one().contact_name == 'Ariadna Agüero'
    assert len(emails) == 1


def test_the_customer_cannot_choose_igv_inside(client, customer, order, quotation, emails):
    _post(client, order, _customer_headers(customer), quotation_id=quotation.id,
          prices_include_igv=True, **CLIENT)

    assert float(FormalQuotation.query.one().total) == 493.24


def test_with_the_reservation_switch_it_shows_the_advance(client, customer, order, quotation, emails,
                                                          monkeypatch):
    monkeypatch.setenv('YAPE_RESERVATION_REQUIRED', 'true')
    _post(client, order, _customer_headers(customer), quotation_id=quotation.id, **CLIENT)

    rows = FormalQuotation.query.one().document['payment_rows']
    assert [r[:3] for r in rows] == [['Adelanto', '7.7%', '38.00'], ['Saldo pendiente', '92.3%', '455.24']]


def test_a_paid_reservation_shows_as_received(client, customer, order, quotation, emails, monkeypatch):
    monkeypatch.setenv('YAPE_RESERVATION_REQUIRED', 'true')
    db.session.add(Payment(order_id=order.id, amount=38, lu_payment_type_id=1, status='paid',
                           concept='reservation', quotation_id=quotation.id))
    db.session.commit()
    _post(client, order, _customer_headers(customer), quotation_id=quotation.id, **CLIENT)

    document = FormalQuotation.query.one().document
    assert document['payment_rows'][0][0] == 'Adelanto recibido'
    assert 'pago del adelanto' not in document['acceptance']


def test_without_loaders_it_is_transport_only(client, customer, order, quotation, emails):
    order.loaders_quantity = 0
    db.session.add(LuServices(id=1, service='packaging', description='Servicio de empaque'))
    db.session.add(OrdersServices(order_id=order.id, service_id=1))
    db.session.commit()
    _post(client, order, _customer_headers(customer), quotation_id=quotation.id, **CLIENT)

    document = FormalQuotation.query.one().document
    rows = dict(document['service_rows'])
    assert rows['Servicio'].endswith('sin carga ni descarga.')
    assert rows['Incluye'] == 'Transporte (flete) con conductor. Además: embalaje de bienes.'
    assert rows['No incluye'].startswith('Carga y descarga (sin cargadores), desarmado/armado de muebles')
    assert 'la carga y descarga estará a cargo del cliente' in ' '.join(document['conditions'][0][1])


@pytest.mark.parametrize('field,value', [
    ('ruc', '20510042991'), ('business_name', ' '), ('contact_email', 'no-es-correo'),
])
def test_bad_client_data_is_400_with_the_field(client, customer, order, quotation, emails, field, value):
    res = _post(client, order, _customer_headers(customer), quotation_id=quotation.id,
                **{**CLIENT, field: value})

    assert res.status_code == 400
    assert res.get_json()['field'] == field
    assert FormalQuotation.query.count() == 0


def test_another_customer_cannot(client, order, quotation, emails):
    other = Customer(name='Otro', email='otro@example.com')
    db.session.add(other)
    db.session.commit()

    res = _post(client, order, _customer_headers(other), quotation_id=quotation.id, **CLIENT)
    assert res.status_code == 403


def test_without_session_is_401(client, order, quotation):
    assert _post(client, order, {}, quotation_id=quotation.id, **CLIENT).status_code == 401


def test_a_cancelled_or_foreign_quotation_is_404(client, customer, order, quotation, carrier_company, emails):
    quotation.quotation_status_id = QuotationStatus.Cancelled()
    other_order = Order(customer_id=customer.id)
    db.session.add(other_order)
    db.session.commit()
    foreign = Quotations(order_id=other_order.id, carrier_company_id=carrier_company.id, amount=100)
    db.session.add(foreign)
    db.session.commit()

    for quotation_id in (quotation.id, foreign.id, 'x'):
        res = _post(client, order, _customer_headers(customer), quotation_id=quotation_id, **CLIENT)
        assert res.status_code == 404


def test_a_cancelled_order_is_409_for_the_customer(client, customer, order, quotation, emails):
    order.order_status_id = OrderStatus.cancelled()
    db.session.commit()

    res = _post(client, order, _customer_headers(customer), quotation_id=quotation.id, **CLIENT)
    assert res.status_code == 409


def test_the_list_prefills_from_the_customers_last_one(client, customer, order, quotation, emails):
    _post(client, order, _customer_headers(customer), quotation_id=quotation.id, **CLIENT)
    later = Order(customer_id=customer.id)
    db.session.add(later)
    db.session.commit()

    res = client.get(f'/api/v1/order/{later.id}/formal-quotations', headers=_customer_headers(customer))

    body = res.get_json()
    assert body['formal_quotations'] == []
    assert body['last_client']['ruc'] == RUC
    assert 'quotations' not in body


def test_download_again_from_what_was_saved(client, customer, order, quotation, emails):
    _post(client, order, _customer_headers(customer), quotation_id=quotation.id, **CLIENT)
    row = FormalQuotation.query.one()
    order.comments = 'otra cosa'
    db.session.commit()

    res = client.get(f'/api/v1/formal-quotations/{row.id}/pdf', headers=_customer_headers(customer))
    assert res.status_code == 200 and res.data.startswith(b'%PDF')
    assert dict(row.document['service_rows'])['Carga a trasladar'] == '1 microondas, 5 cajoneras'

    other = Customer(name='Otro', email='otro@example.com')
    db.session.add(other)
    db.session.commit()
    res = client.get(f'/api/v1/formal-quotations/{row.id}/pdf', headers=_customer_headers(other))
    assert res.status_code == 403


# --- Backoffice (token interno) -------------------------------------------

def test_the_backoffice_can_put_igv_inside_and_skip_the_advance(client, order, quotation, emails, monkeypatch):
    monkeypatch.setenv('YAPE_RESERVATION_REQUIRED', 'true')
    res = _post(client, order, _internal_headers(), quotation_id=quotation.id, prices_include_igv=True,
                include_reservation=False, admin_user_id=7, **CLIENT)

    assert res.status_code == 200
    row = FormalQuotation.query.one()
    assert (float(row.subtotal), float(row.igv), float(row.total)) == (354.24, 63.76, 418.0)
    assert row.created_by_admin_id == 7
    assert [r[0] for r in row.document['payment_rows']] == ['Pago único']
    # El admin la descarga y la manda él.
    assert emails == []


def test_the_backoffice_list_brings_the_quotations(client, order, quotation):
    res = client.get(f'/api/v1/order/{order.id}/formal-quotations', headers=_internal_headers())

    quotations = res.get_json()['quotations']
    assert quotations == [{'id': quotation.id, 'carrier_company_name': 'Jhon Romero', 'amount': 380,
                           'total_amount': 418.0, 'selected': False}]


# --- Nota de contabilidad -------------------------------------------------

def _second_quotation(order, customer):
    from app.models import CarrierCompany
    other = CarrierCompany(name='Otra Empresa', active=1)
    db.session.add(other)
    db.session.commit()
    db.session.add(Vehicle(carrier_company_id=other.id, active=1))
    quotation = Quotations(order_id=order.id, carrier_company_id=other.id, amount=500,
                           quotation_status_id=QuotationStatus.Active())
    db.session.add(quotation)
    db.session.commit()
    return quotation


def test_downloading_it_does_not_mark_the_order(client, customer, order, quotation, emails):
    _post(client, order, _customer_headers(customer), quotation_id=quotation.id, **CLIENT)

    assert db.session.get(Order, order.id).accounting_note is None


def test_choosing_it_writes_what_accounting_and_purchasing_need(client, customer, order, quotation, emails):
    _post(client, order, _customer_headers(customer), quotation_id=quotation.id, **CLIENT)

    res = client.put(f'/api/v1/quotation/{quotation.id}', json={}, headers=_customer_headers(customer))

    assert res.status_code == 200
    note = db.session.get(Order, order.id).accounting_note
    assert note.startswith('[Cotización formal N.° ')
    assert 'Chalán factura a PMS GESTION INTEGRAL SAC (RUC 20510042990): S/ 493.24 = subtotal 418.00 + IGV 75.24.' in note
    assert 'a la cuenta de Titular Ejemplo (pago único S/ 493.24)' in note
    assert 'Chalán le paga a Jhon Romero S/ 380.00' in note
    assert 'factura o recibo por honorarios' in note


def test_generating_it_for_the_chosen_one_writes_it_and_keeps_the_admins_text(client, order, quotation, emails):
    quotation.quotation_status_id = QuotationStatus.Selected()
    order.accounting_note = 'Llamar a la contadora.'
    db.session.commit()

    _post(client, order, _internal_headers(), quotation_id=quotation.id, **CLIENT)
    _post(client, order, _internal_headers(), quotation_id=quotation.id, prices_include_igv=True, **CLIENT)

    note = db.session.get(Order, order.id).accounting_note
    assert note.count('[Cotización formal') == 1  # se reemplaza, no se suma
    assert 'S/ 418.00 = subtotal 354.24 + IGV 63.76' in note
    assert note.endswith('\n\nLlamar a la contadora.')


def test_choosing_another_one_removes_the_block(client, customer, order, quotation, emails):
    other = _second_quotation(order, customer)
    _post(client, order, _customer_headers(customer), quotation_id=quotation.id, **CLIENT)
    client.put(f'/api/v1/quotation/{quotation.id}', json={}, headers=_customer_headers(customer))
    order_row = db.session.get(Order, order.id)
    order_row.accounting_note += '\n\nNota a mano.'
    db.session.commit()

    client.put(f'/api/v1/quotation/{other.id}', json={}, headers=_customer_headers(customer))

    assert db.session.get(Order, order.id).accounting_note == 'Nota a mano.'


def test_the_bank_comes_from_the_environment(client, customer, order, quotation, emails):
    _post(client, order, _customer_headers(customer), quotation_id=quotation.id, **CLIENT)

    document = FormalQuotation.query.one().document
    assert document['bank_rows'] == [
        ['Titular de la cuenta', 'Titular Ejemplo'],
        ['Banco', 'BCP – Cuenta de ahorros en soles'],
        ['N.° de cuenta', '1234567890'],
        ['CCI (interbancaria)', '00212345678901234567'],
    ]
    assert document['issuer']['signer'] == 'Firmante Ejemplo'


def test_without_an_account_it_asks_for_it_instead_of_an_empty_one(client, customer, order, quotation, emails,
                                                                   monkeypatch):
    for name in ('FORMAL_QUOTATION_BANK_ACCOUNT', 'FORMAL_QUOTATION_BANK_HOLDER', 'FORMAL_QUOTATION_SIGNER'):
        monkeypatch.delenv(name)
    _post(client, order, _customer_headers(customer), quotation_id=quotation.id, **CLIENT)
    client.put(f'/api/v1/quotation/{quotation.id}', json={}, headers=_customer_headers(customer))

    document = FormalQuotation.query.one().document
    assert document['bank_rows'] == [['Cuenta para el depósito',
                                      'Se envía al confirmar la cotización; escríbanos a carlos.calderon@chalan.pe.']]
    assert document['issuer']['signer'] == 'Chalán Soluciones E.I.R.L.'
    assert 'a la cuenta de Chalán (' in db.session.get(Order, order.id).accounting_note
