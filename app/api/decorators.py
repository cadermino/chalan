
from flask import request
from functools import wraps
from ..models import Customer
from .errors import bad_request, unauthorized

def token_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        auth_headers = request.headers.get('Authorization', '').split()
        if not auth_headers:
            return unauthorized('Missing token')
        customer = Customer.verify_auth_token(auth_headers[1])
        if customer is not None:
            kwargs['customer_data'] = customer
            return func(*args, **kwargs)
        return bad_request('Invalid token')
    return wrapper