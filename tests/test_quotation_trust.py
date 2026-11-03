"""Lo que la tarjeta de cotización muestra de la empresa además de sus reseñas.

A una empresa sin reseñas no se le inventan estrellas: el cliente ve "Nuevo en
Chalán" y, cuando es cierto, que entregó sus documentos y cuántas mudanzas hizo.
"""
from app import db
from app.api.order.order_status import OrderStatus
from app.api.quotation import Quotation as QuotationEntity
from app.api.quotation.quotation_status import QuotationStatus
from app.models import CarrierDocument, Order, Quotations, Vehicle


def _listed(order):
    return QuotationEntity().listByOrderId(order.id).toJson().get_json()[0]


def _quote(order, company, status=None):
    quotation = Quotations(order_id=order.id, carrier_company_id=company.id, amount=300,
                           quotation_status_id=status or QuotationStatus.Active())
    db.session.add(quotation)
    db.session.commit()
    return quotation


def _document(company, doc_type):
    db.session.add(CarrierDocument(carrier_company_id=company.id, doc_type=doc_type,
                                   storage_key=f'carrier-documents/{company.id}/{doc_type}-x.jpg'))
    db.session.commit()


def test_a_new_company_has_nothing_to_show(order, carrier_company):
    db.session.add(Vehicle(carrier_company_id=carrier_company.id, active=1))
    _quote(order, carrier_company)

    listed = _listed(order)

    assert listed['documents_verified'] is False
    assert listed['completed_moves'] == 0


def test_documents_count_only_with_the_three_of_them(order, carrier_company):
    db.session.add(Vehicle(carrier_company_id=carrier_company.id, active=1))
    _quote(order, carrier_company)
    _document(carrier_company, 'identity')
    _document(carrier_company, 'driver_license')

    assert _listed(order)['documents_verified'] is False

    _document(carrier_company, 'vehicle_card')
    assert _listed(order)['documents_verified'] is True


def test_moves_are_its_chosen_quotations_in_completed_orders(order, customer, carrier_company):
    db.session.add(Vehicle(carrier_company_id=carrier_company.id, active=1))
    _quote(order, carrier_company)
    for status, quotation_status in [
        (OrderStatus.completed(), QuotationStatus.Selected()),
        (OrderStatus.completed(), QuotationStatus.Selected()),
        (OrderStatus.in_progress(), QuotationStatus.Selected()),  # todavía no la hizo
        (OrderStatus.completed(), QuotationStatus.Active()),  # eligieron a otra
    ]:
        past = Order(customer_id=customer.id, order_status_id=status)
        db.session.add(past)
        db.session.commit()
        _quote(past, carrier_company, quotation_status)

    assert _listed(order)['completed_moves'] == 2
