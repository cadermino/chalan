import jwt
import pytest

from app import db
from app.models import CarrierCompany, Quotations, Review


@pytest.fixture(autouse=True)
def completed(order, carrier_company):
    """Lo que tiene una orden para la que el backoffice da link de reseña:
    completada y con la cotización elegida de esa empresa."""
    order.order_status_id = 3
    db.session.add(Quotations(order_id=order.id, carrier_company_id=carrier_company.id, amount=300,
                             quotation_status_id=2))
    db.session.commit()


def _sign(app, payload):
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')


def _token(app, order, carrier_company, customer=None, **extra):
    """Un link de reseña como los que se mandaron antes de `purpose`."""
    return _sign(app, {
        'order_id': order.id,
        'customer_id': customer.id if customer else order.customer_id,
        'carrier_company_id': carrier_company.id,
        **extra,
    })


def test_create_review_with_platform_feedback_stores_both_ratings(app, client, order, carrier_company, customer):
    token = _token(app, order, carrier_company, customer)

    res = client.post('/api/v1/reviews', json={
        'token': token,
        'rating': 5,
        'comment': 'Excelente servicio',
        'platform_rating': 4,
        'platform_comment': 'Cotizar fue muy facil',
    })

    assert res.status_code == 201
    review = db.session.get(Review, res.get_json()['id'])
    assert review.rating == 5
    assert review.platform_rating == 4
    assert review.platform_comment == 'Cotizar fue muy facil'


def test_platform_feedback_is_optional(app, client, order, carrier_company, customer):
    token = _token(app, order, carrier_company, customer)

    res = client.post('/api/v1/reviews', json={
        'token': token,
        'rating': 3,
        'comment': 'Sin feedback de plataforma',
    })

    assert res.status_code == 201
    review = db.session.get(Review, res.get_json()['id'])
    assert review.platform_rating is None
    assert review.platform_comment is None


def test_platform_rating_out_of_range_is_rejected(app, client, order, carrier_company, customer):
    token = _token(app, order, carrier_company, customer)

    res = client.post('/api/v1/reviews', json={
        'token': token,
        'rating': 5,
        'comment': 'x',
        'platform_rating': 6,
    })

    assert res.status_code == 400
    assert 'plataforma' in res.get_json()['error']


def test_duplicate_review_for_same_order_is_rejected(app, client, order, carrier_company, customer):
    token = _token(app, order, carrier_company, customer)
    first = client.post('/api/v1/reviews', json={'token': token, 'rating': 5, 'comment': 'primero'})
    assert first.status_code == 201

    second = client.post('/api/v1/reviews', json={'token': token, 'rating': 4, 'comment': 'segundo'})
    assert second.status_code == 409


def test_verify_token_reports_already_reviewed_after_submission(app, client, order, carrier_company, customer):
    token = _token(app, order, carrier_company, customer)
    client.post('/api/v1/reviews', json={'token': token, 'rating': 5, 'comment': 'listo'})

    res = client.get(f'/api/v1/reviews/verify/{token}')

    assert res.status_code == 200
    assert res.get_json()['already_reviewed'] is True


def test_invalid_token_is_rejected(client):
    res = client.get('/api/v1/reviews/verify/not-a-real-token')
    assert res.status_code == 400


def test_a_review_link_with_its_purpose_works(app, client, order, carrier_company, customer):
    token = _token(app, order, carrier_company, customer, purpose='review')

    assert client.post('/api/v1/reviews', json={'token': token, 'rating': 5, 'comment': 'ok'}).status_code == 201


def test_a_review_without_the_link_is_rejected(client, order, carrier_company):
    res = client.post('/api/v1/reviews', json={
        'order_id': order.id, 'carrier_company_id': carrier_company.id, 'rating': 5, 'comment': 'falsa',
    })

    assert res.status_code == 400
    assert Review.query.count() == 0


def test_a_carriers_quotation_link_cannot_review_its_own_move(app, client, order, carrier_company):
    # El link de cotizar trae order_id y carrier_company_id, con la misma firma.
    quotation_link = _sign(app, {'carrier_company_id': carrier_company.id, 'order_id': order.id})

    assert client.get(f'/api/v1/reviews/verify/{quotation_link}').status_code == 400
    assert client.post('/api/v1/reviews', json={'token': quotation_link, 'rating': 5, 'comment': 'yo'}).status_code == 400
    assert Review.query.count() == 0


def test_a_token_with_another_purpose_is_rejected(app, client, order, carrier_company, customer):
    token = _token(app, order, carrier_company, customer, purpose='service_request')

    assert client.post('/api/v1/reviews', json={'token': token, 'rating': 5, 'comment': 'x'}).status_code == 400


def test_a_link_for_a_company_that_was_not_chosen_is_rejected(app, client, order, customer):
    other = CarrierCompany(name='Otra SAC', active=1)
    db.session.add(other)
    db.session.commit()
    token = _token(app, order, other, customer)

    assert client.post('/api/v1/reviews', json={'token': token, 'rating': 1, 'comment': 'x'}).status_code == 400


def test_a_move_that_is_not_completed_cannot_be_reviewed(app, client, order, carrier_company, customer):
    order.order_status_id = 2
    db.session.commit()
    token = _token(app, order, carrier_company, customer)

    assert client.post('/api/v1/reviews', json={'token': token, 'rating': 5, 'comment': 'x'}).status_code == 400


def test_a_link_for_another_customer_is_rejected(app, client, order, carrier_company):
    token = _sign(app, {'order_id': order.id, 'customer_id': order.customer_id + 1,
                        'carrier_company_id': carrier_company.id})

    assert client.post('/api/v1/reviews', json={'token': token, 'rating': 5, 'comment': 'x'}).status_code == 400
