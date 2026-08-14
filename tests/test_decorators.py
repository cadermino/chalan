def test_token_required_with_malformed_header_returns_401_not_500(client, customer):
    # Regression test: auth_headers[1] was indexed without checking length,
    # so a single-word Authorization header (no "Bearer" prefix) passed the
    # `if not auth_headers` check but crashed with IndexError, surfaced as a
    # raw 500 in production (app/api/decorators.py:14).
    res = client.get(
        f'/api/v1/customer/{customer.id}/last-pending-order',
        headers={'Authorization': 'malformed'},
    )

    assert res.status_code == 401


def test_token_required_with_missing_header_returns_401(client, customer):
    res = client.get(f'/api/v1/customer/{customer.id}/last-pending-order')

    assert res.status_code == 401


def test_token_required_with_valid_token_succeeds(client, customer):
    token = customer.generate_auth_token(3600)
    res = client.get(
        f'/api/v1/customer/{customer.id}/last-pending-order',
        headers={'Authorization': f'Bearer {token}'},
    )

    assert res.status_code == 200
