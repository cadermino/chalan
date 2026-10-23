"""La nota del transportista en una cotización de mudanza.

Lo que aclara junto al precio ("voy con 2 cargadores", "en 2 viajes"). La ve
el cliente al lado de esa cotización; en el link de cada transportista solo
viene la suya, porque ese link lista todas las cotizaciones de la orden.
"""
import pytest

from app import db
from app.api.carrier_company import CarrierCompany as CarrierCompanyEntity
from app.api.quotation import Quotation as QuotationEntity
from app.models import CarrierCompany, Quotations, Vehicle


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


def test_a_carrier_link_shows_only_its_own_note(client, order, carrier_company):
    other = CarrierCompany(name='Otra', active=1)
    db.session.add(other)
    db.session.commit()
    _quote(client, order, carrier_company, note='Mi nota')
    _quote(client, order, other, note='La nota de otro')

    res = client.get('/api/v1/orders/details', headers={'Authorization': f'Bearer {_token(order, carrier_company)}'})

    assert res.status_code == 200
    by_company = {q['carrier_company_id']: q for q in res.get_json()['order']['quotations']}
    assert by_company[carrier_company.id]['note'] == 'Mi nota'
    assert 'note' not in by_company[other.id]
