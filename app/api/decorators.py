
from flask import request
from functools import wraps
from ..models import Customer
from .errors import bad_request

def token_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        auth_headers = request.headers.get('Authorization', '').split()
        customer = Customer.verify_auth_token(auth_headers[1])
        print(customer)
        if customer is not None:
            return func(*args, **kwargs)
        return bad_request('Not valid token')
    return wrapper