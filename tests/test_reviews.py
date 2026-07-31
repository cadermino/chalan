import jwt

from app import db
from app.models import Review


def _token(app, order, carrier_company, customer=None):
    payload = {
        'order_id': order.id,
        'customer_id': customer.id if customer else order.customer_id,
        'carrier_company_id': carrier_company.id,
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')


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
