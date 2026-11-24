"""Link corto de reseña (chalan.pe/r/o<orden>-<firma>, chalan.pe/r/s<solicitud>-<firma>).

Se prueba que se canjee por un token que la página de reseña acepta, que no se
pueda cambiar el número ni la letra para reseñar otra cosa, que solo sirva
mientras se puede reseñar, y que el backoffice-api arme el mismo código.
"""
import importlib.util
from datetime import datetime
from pathlib import Path

import pytest

from app import db
from app.api.review_short_link import ORDER, SERVICE, make_code
from app.models import Quotations, ServiceRequest, ServiceRequestQuotation, ServiceType


@pytest.fixture
def completed_order(order, carrier_company):
    order.order_status_id = 3
    db.session.add(Quotations(order_id=order.id, carrier_company_id=carrier_company.id, amount=300,
                             quotation_status_id=2))
    db.session.commit()
    return order


@pytest.fixture
def completed_service(app, carrier_company):
    service_type = ServiceType(code='packing', name='Embalaje', requestable=1)
    db.session.add(service_type)
    db.session.flush()
    service_request = ServiceRequest(public_id='a' * 32, service_type_id=service_type.id, status='completed',
                                     customer_name='Carla Rojas', submitted_at=datetime(2026, 10, 1))
    db.session.add(service_request)
    db.session.flush()
    db.session.add(ServiceRequestQuotation(service_request_id=service_request.id,
                                           carrier_company_id=carrier_company.id, amount=300, status='selected'))
    db.session.commit()
    return service_request


def redeem(client, code):
    return client.get(f'/api/v1/review-links/{code}')


def verify(client, res):
    return client.get(f"/api/v1/reviews/verify/{res.get_json()['token']}")


def test_an_order_code_opens_the_review_of_that_move(client, completed_order, carrier_company):
    res = redeem(client, make_code(ORDER, completed_order.id))

    assert res.status_code == 200
    data = verify(client, res).get_json()
    assert (data['order_id'], data['carrier_company_id']) == (completed_order.id, carrier_company.id)


def test_a_service_code_opens_the_review_of_that_service(client, completed_service, carrier_company):
    res = redeem(client, make_code(SERVICE, completed_service.id))

    assert res.status_code == 200
    data = verify(client, res).get_json()
    assert (data['service_request_id'], data['carrier_company_id']) == (completed_service.id, carrier_company.id)


def test_the_link_is_short(app):
    assert len(f'https://chalan.pe/r/{make_code(ORDER, 12345)}') < 40


def test_changing_the_number_or_the_letter_breaks_the_signature(client, completed_order, completed_service):
    order_signature = make_code(ORDER, completed_order.id).split('-', 1)[1]

    assert redeem(client, f'o{completed_order.id + 1}-{order_signature}').status_code == 404
    # La misma firma no abre el servicio con ese número.
    assert redeem(client, f's{completed_order.id}-{order_signature}').status_code == 404


@pytest.mark.parametrize('code', ['nada', 'o1', 'o1-', 'x1-abcdefghij', '1-abcdefghij'])
def test_a_made_up_code_is_rejected(client, code):
    assert redeem(client, code).status_code == 404


def test_it_only_works_while_the_move_can_be_reviewed(client, order, carrier_company):
    code = make_code(ORDER, order.id)
    assert redeem(client, code).status_code == 404   # pendiente

    order.order_status_id = 3
    db.session.commit()
    assert redeem(client, code).status_code == 404   # sin cotización elegida

    db.session.add(Quotations(order_id=order.id, carrier_company_id=carrier_company.id, amount=300,
                             quotation_status_id=2))
    db.session.commit()
    assert redeem(client, code).status_code == 200


def test_a_service_no_longer_completed_has_no_review(client, completed_service):
    completed_service.status = 'in_progress'
    db.session.commit()

    assert redeem(client, make_code(SERVICE, completed_service.id)).status_code == 404


def test_the_backoffice_makes_the_same_code(app):
    path = Path(__file__).resolve().parents[1] / 'backoffice-api' / 'app' / 'review_short_link.py'
    if not path.exists():
        pytest.skip('backoffice-api is not mounted in this container')
    spec = importlib.util.spec_from_file_location('backoffice_review_short_link', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    assert module.make_code('o', 12) == make_code(ORDER, 12)
    assert module.make_code('s', 12) == make_code(SERVICE, 12)
