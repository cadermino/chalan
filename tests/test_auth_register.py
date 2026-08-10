from app.models import Customer


def _payload(**overrides):
    payload = {
        'name': 'Juan Perez',
        'mobile_phone': '+51987654321',
        'email': 'juan@example.com',
        'password': 'testpass123',
    }
    payload.update(overrides)
    return payload


def test_register_with_long_email_succeeds(client):
    # Regression test for 22c714f: customers.email was VARCHAR(45), and
    # anything longer raised an uncaught sqlalchemy.exc.DataError (a
    # different class than the IntegrityError already handled for
    # duplicates), surfaced as a raw 500. Migration 013 widened the column
    # to VARCHAR(255) in Postgres — this test's SQLite backend doesn't
    # enforce VARCHAR length at all, so it can't catch a regression of the
    # column width itself, only that registration logic handles a long
    # email without erroring for unrelated reasons.
    long_email = 'juan.perez-test-claude-3-1786205628059@example.com'
    assert len(long_email) > 45

    res = client.post('/api/auth/register', json=_payload(email=long_email))

    assert res.status_code == 201
    customer = Customer.query.filter_by(email=long_email).first()
    assert customer is not None
    assert customer.email == long_email


def test_register_with_duplicate_email_returns_400(client):
    client.post('/api/auth/register', json=_payload())
    res = client.post('/api/auth/register', json=_payload())

    assert res.status_code == 400
    assert res.get_json()['message'] == 'duplicated email'


def test_register_missing_field_returns_400(client):
    payload = _payload()
    del payload['mobile_phone']

    res = client.post('/api/auth/register', json=payload)

    assert res.status_code == 400
