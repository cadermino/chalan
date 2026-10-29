from datetime import datetime

import pytest

from app import db
from app.api.service_request.reviews import make_review_token
from app.models import CarrierCompany, Review, ServiceRequest, ServiceRequestQuotation, ServiceType


@pytest.fixture
def packing(app):
    service_type = ServiceType(code='packing', name='Embalaje', requestable=1)
    db.session.add(service_type)
    db.session.commit()
    return service_type


def make_request(packing, company, status='completed', public_id='a' * 32):
    service_request = ServiceRequest(public_id=public_id, service_type_id=packing.id, status=status,
                                     customer_name='Carla Rojas', submitted_at=datetime(2026, 10, 1))
    db.session.add(service_request)
    db.session.flush()
    db.session.add(ServiceRequestQuotation(service_request_id=service_request.id, carrier_company_id=company.id,
                                           amount=300, status='selected'))
    db.session.commit()
    return service_request


@pytest.fixture
def contact(app):
    """Un contacto de Google Maps que cargó el admin: inactivo, con quien contesta."""
    company = CarrierCompany(name='Embalajes Rojas EIRL', contact_name='Jorge', active=0)
    db.session.add(company)
    db.session.commit()
    return company


def review(client, token, **body):
    return client.post('/api/v1/reviews', json={'token': token, 'rating': 5, 'comment': 'Muy cuidadosos', **body})


def test_a_completed_request_gets_a_review_link_that_names_who_answered(client, packing, contact):
    token = make_review_token(make_request(packing, contact))

    data = client.get(f'/api/v1/reviews/verify/{token}').get_json()

    assert data['carrier_company_name'] == 'Jorge'
    assert data['service_name'] == 'Embalaje'
    assert data['already_reviewed'] is False
    assert 'Rojas EIRL' not in str(data)


def test_reviewing_a_service_stores_it_without_an_order_or_customer(client, packing, contact):
    service_request = make_request(packing, contact)
    token = make_review_token(service_request)

    response = review(client, token, platform_rating=4, platform_comment='Fácil')

    assert response.status_code == 201
    saved = db.session.get(Review, response.get_json()['id'])
    assert (saved.service_request_id, saved.carrier_company_id) == (service_request.id, contact.id)
    assert (saved.order_id, saved.customer_id) == (None, None)
    assert (saved.rating, saved.platform_rating, saved.platform_comment) == (5, 4, 'Fácil')
    assert client.get(f'/api/v1/reviews/verify/{token}').get_json()['already_reviewed'] is True


def test_a_service_is_reviewed_once(client, packing, contact):
    token = make_review_token(make_request(packing, contact))
    review(client, token)

    response = review(client, token)

    assert response.status_code == 409
    assert Review.query.count() == 1


def test_a_service_review_validates_the_rating(client, packing, contact):
    token = make_review_token(make_request(packing, contact))

    assert review(client, token, rating=6).status_code == 400
    assert review(client, token, platform_rating=0).status_code == 400
    assert Review.query.count() == 0


def test_only_a_completed_request_has_a_review_link(packing, contact):
    assert make_review_token(make_request(packing, contact, status='in_progress')) is None


def test_the_link_stops_working_if_the_request_is_no_longer_completed(client, packing, contact):
    service_request = make_request(packing, contact)
    token = make_review_token(service_request)
    service_request.status = 'in_progress'
    db.session.commit()

    assert client.get(f'/api/v1/reviews/verify/{token}').status_code == 400
    assert review(client, token).status_code == 400


def test_the_link_stops_working_if_another_company_is_chosen(client, packing, contact):
    service_request = make_request(packing, contact)
    token = make_review_token(service_request)
    other = CarrierCompany(name='Otra SAC', active=1)
    db.session.add(other)
    db.session.commit()
    service_request.quotations[0].carrier_company_id = other.id
    db.session.commit()

    assert review(client, token).status_code == 400


def test_the_customer_page_offers_the_review_only_once_completed(client, packing, contact):
    service_request = make_request(packing, contact, status='in_progress')
    url = f'/api/v1/service-requests/{service_request.public_id}/quotations'
    assert client.get(url).get_json()['review_path'] is None

    service_request.status = 'completed'
    db.session.commit()
    data = client.get(url).get_json()

    assert data['review_path'].startswith('/reviews/submit/')
    assert data['reviewed'] is False


def test_the_customer_page_shows_each_companys_rating(client, packing, contact):
    service_request = make_request(packing, contact)
    review(client, make_review_token(service_request), rating=4)
    other = make_request(packing, contact, status='pending', public_id='b' * 32)

    data = client.get(f'/api/v1/service-requests/{other.public_id}/quotations').get_json()

    assert data['quotations'][0]['rating'] == {'average': 4.0, 'count': 1}


def test_a_company_without_reviews_has_no_rating(client, packing, contact):
    service_request = make_request(packing, contact, status='pending')

    data = client.get(f'/api/v1/service-requests/{service_request.public_id}/quotations').get_json()

    assert data['quotations'][0]['rating'] is None


def test_an_inactive_contact_has_no_public_page_or_testimonials(client, packing, contact):
    review(client, make_review_token(make_request(packing, contact)))

    assert client.get(f'/api/v1/reviews/company/{contact.id}').status_code == 404
    assert client.get('/api/v1/reviews/recent').get_json() == []


def test_a_registered_company_shows_its_service_reviews_with_the_customers_short_name(client, packing):
    company = CarrierCompany(name='Embala SAC', active=1)
    db.session.add(company)
    db.session.commit()
    review(client, make_review_token(make_request(packing, company)))

    page = client.get(f'/api/v1/reviews/company/{company.id}').get_json()
    recent = client.get('/api/v1/reviews/recent').get_json()

    assert page['total_reviews'] == 1
    assert page['reviews'][0]['customer_name'] == 'Carla R.'
    assert recent[0]['customer_name'] == 'Carla R.'
