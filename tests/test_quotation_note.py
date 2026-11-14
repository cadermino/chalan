"""La nota del transportista en una cotización de mudanza.

Lo que aclara junto al precio ("voy con 2 cargadores", "en 2 viajes"). La ve
el cliente al lado de esa cotización; el link de cada transportista solo trae
su propia cotización.
"""
import importlib.util
from pathlib import Path

import pytest

from app import db
from app.api import customer_note
from app.api.carrier_company import CarrierCompany as CarrierCompanyEntity
from app.api.quotation import Quotation as QuotationEntity
from app.api.quotation.quotation_status import QuotationStatus
from app.models import CarrierCompany, OrderDetails, Quotations, Vehicle


@pytest.fixture(autouse=True)
def quiet(monkeypatch):
    monkeypatch.setattr('app.api.quotations.send_email', lambda *a, **kw: None)
    monkeypatch.setattr('app.api.quotations.send_whatsapp', lambda *a, **kw: None)


def _token(order, company):
    return CarrierCompanyEntity().generate_carrier_company_token(3600, order.id, company.id)


def _quote(client, order, company, **body):
    return client.post('/api/v1/quotations', json={'amount': 500, **body},
                       headers={'Authorization': f'Bearer {_token(order, company)}'})


def test_the_note_is_saved_with_the_price(client, order, carrier_company):
    res = _quote(client, order, carrier_company, note='  Voy con 2 cargadores, en 2 viajes.  ')

    assert res.status_code == 201
    assert res.get_json()['note'] == 'Voy con 2 cargadores, en 2 viajes.'
    assert Quotations.query.one().note == 'Voy con 2 cargadores, en 2 viajes.'


def test_without_a_note_it_stays_empty(client, order, carrier_company):
    assert _quote(client, order, carrier_company).status_code == 201
    assert Quotations.query.one().note is None
    _quote(client, order, carrier_company, note='   ')
    assert Quotations.query.one().note is None


@pytest.mark.parametrize('note', ['x' * 501, 123, ['2 cargadores']])
def test_a_bad_note_is_rejected(client, order, carrier_company, note):
    res = _quote(client, order, carrier_company, note=note)

    assert res.status_code == 400
    assert Quotations.query.count() == 0


def test_requoting_changes_the_note_only_when_sent(client, order, carrier_company):
    _quote(client, order, carrier_company, note='2 cargadores')

    res = _quote(client, order, carrier_company, amount=450)
    assert res.status_code == 200
    assert res.get_json()['note'] == '2 cargadores'
    assert Quotations.query.one().note == '2 cargadores'

    _quote(client, order, carrier_company, amount=450, note='3 cargadores')
    assert Quotations.query.one().note == '3 cargadores'

    _quote(client, order, carrier_company, amount=450, note='')
    assert Quotations.query.one().note is None


def test_the_customer_sees_the_note(client, order, carrier_company):
    db.session.add(Vehicle(carrier_company_id=carrier_company.id, active=1))
    db.session.commit()
    _quote(client, order, carrier_company, note='Incluye embalaje del sofá')

    listed = QuotationEntity().listByOrderId(order.id).toJson().get_json()

    assert listed[0]['note'] == 'Incluye embalaje del sofá'



def test_the_customer_does_not_see_a_phone_written_in_the_note(client, order, carrier_company):
    db.session.add(Vehicle(carrier_company_id=carrier_company.id, active=1))
    db.session.commit()
    _quote(client, order, carrier_company, note='Escríbeme al +51 987654321')

    listed = QuotationEntity().listByOrderId(order.id).toJson().get_json()

    assert listed[0]['note'] is None


def test_the_customer_does_not_see_an_amount_written_in_the_note(client, order, carrier_company):
    db.session.add(Vehicle(carrier_company_id=carrier_company.id, active=1))
    db.session.commit()
    _quote(client, order, carrier_company, note='carro por viaje 290 soles, estibas S/ 80.00 c/u, voy con 2 cargadores')

    listed = QuotationEntity().listByOrderId(order.id).toJson().get_json()

    assert listed[0]['note'] == 'Voy con 2 cargadores'
    # El transportista y el admin la siguen leyendo entera.
    assert Quotations.query.one().note.startswith('carro por viaje 290 soles')

def test_a_carrier_link_shows_only_its_own_note(client, order, carrier_company):
    other = CarrierCompany(name='Otra', active=1)
    db.session.add(other)
    db.session.commit()
    _quote(client, order, carrier_company, note='Mi nota')
    _quote(client, order, other, note='La nota de otro')

    res = client.get('/api/v1/orders/details', headers={'Authorization': f'Bearer {_token(order, carrier_company)}'})

    assert res.status_code == 200
    quotations = res.get_json()['order']['quotations']
    assert [q['carrier_company_id'] for q in quotations] == [carrier_company.id]
    assert quotations[0]['note'] == 'Mi nota'


def _details(client, order, company):
    res = client.get('/api/v1/orders/details', headers={'Authorization': f'Bearer {_token(order, company)}'})
    assert res.status_code == 200
    return res.get_json()['order']


def test_a_carrier_link_does_not_show_the_customer_or_the_chosen_competitor(client, order, carrier_company):
    other = CarrierCompany(name='Otra', active=1)
    db.session.add(other)
    db.session.commit()
    _quote(client, order, carrier_company)
    _quote(client, order, other)
    chosen = Quotations.query.filter_by(order_id=order.id, carrier_company_id=other.id).one()
    chosen.quotation_status_id = QuotationStatus.Selected()
    db.session.commit()

    mine = _details(client, order, carrier_company)
    theirs = _details(client, order, other)

    assert 'customers' not in mine
    assert not {'selected_quotation_id', 'amount', 'vehicle'} & mine.keys()
    assert mine['payments'] == []
    assert theirs['selected_quotation_id'] == chosen.id
    assert 'customers' not in theirs


def test_a_carrier_link_does_not_show_the_customers_whatsapp_or_the_winners_total(client, order, carrier_company):
    # OrderSchema vuelca todas las columnas: venían lead_phone y total_amount,
    # que con otra empresa elegida es el total del ganador.
    other = CarrierCompany(name='Otra', active=1)
    db.session.add(other)
    db.session.commit()
    _quote(client, order, carrier_company)
    _quote(client, order, other)
    Quotations.query.filter_by(order_id=order.id, carrier_company_id=other.id).one().quotation_status_id = \
        QuotationStatus.Selected()
    order.lead_phone = '987654321'
    order.total_amount = 330.0
    db.session.commit()

    for company in (carrier_company, other):
        seen = _details(client, order, company)
        assert not {'lead_phone', 'total_amount', 'customer_id'} & seen.keys(), company.name
        assert seen['id'] == order.id


def test_the_loser_sees_the_street_without_the_number_once_another_company_is_chosen(
        client, order, carrier_company):
    # La dirección exacta es para cotizar la ruta; elegida otra empresa, el link
    # le seguía mostrando la casa a quien perdió.
    other = CarrierCompany(name='Otra', active=1)
    db.session.add_all([other, OrderDetails(order_id=order.id, type='carry_from', street='Av. Arequipa 1234, Lince 15046',
                                            interior_number='302', map_url='https://maps.google.com/x',
                                            latitude=-12.08, longitude=-77.03)])
    db.session.commit()
    _quote(client, order, carrier_company)
    _quote(client, order, other)
    pending = _details(client, order, carrier_company)['order_details'][0]
    assert pending['street'] == 'Av. Arequipa 1234, Lince 15046'
    assert pending['interior_number'] == '302'

    Quotations.query.filter_by(order_id=order.id, carrier_company_id=other.id).one().quotation_status_id = \
        QuotationStatus.Selected()
    db.session.commit()
    lost = _details(client, order, carrier_company)['order_details'][0]
    won = _details(client, order, other)['order_details'][0]

    assert lost['street'] == 'Av. Arequipa'
    assert lost['interior_number'] is None and lost['map_url'] is None and lost['latitude'] is None
    assert won['street'] == 'Av. Arequipa 1234, Lince 15046'
    assert won['interior_number'] == '302'


@pytest.mark.parametrize('note, shown', [
    ('carro por viaje 290 soles, estibas S/ 80.00 c/u, voy con 2 cargadores', 'Voy con 2 cargadores'),
    ('Mano de obra S/ 35 el m2, materiales 1,200 soles aparte. Vamos 2 personas, 3 días', 'Vamos 2 personas, 3 días'),
    ('Instalación aparte, nos contacta al 934 603 742', 'Instalación aparte'),
    ('Llevo frazadas y film. Total S/. 1,200.50, pago al terminar.', 'Llevo frazadas y film. Pago al terminar.'),
    ('Incluye embalaje.\nPrecio: 300\nLlego a las 8', 'Incluye embalaje.\nLlego a las 8'),
    ('entre 80 a 100 soles', None),
    ('S/ 2 mil', None),
    ('Escríbeme al +51 987654321', None),
    # Números sin moneda quedan, y la nota sin cortes llega tal cual.
    ('Precio 20 m2, demora 3 horas', 'Precio 20 m2, demora 3 horas'),
    ('voy con 2 cargadores y 5 cajas, sol de tarde.', 'voy con 2 cargadores y 5 cajas, sol de tarde.'),
    (None, None),
])
def test_the_customer_reads_the_note_without_the_phrases_with_amounts_or_phones(note, shown):
    assert customer_note.note_for_customer(note) == shown


def test_the_backoffice_copy_of_the_customer_note_is_the_same():
    path = Path(__file__).resolve().parents[1] / 'backoffice-api' / 'app' / 'customer_note.py'
    if not path.exists():
        pytest.skip('backoffice-api is not mounted in this container')
    spec = importlib.util.spec_from_file_location('backoffice_customer_note', path)
    backoffice = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(backoffice)

    assert backoffice.note_for_customer('estibas S/ 80 c/u, voy con 2') == 'Voy con 2'
    assert Path(customer_note.__file__).read_text().split('"""', 2)[2] == path.read_text().split('"""', 2)[2]
