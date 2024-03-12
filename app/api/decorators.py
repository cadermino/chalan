
from flask import request
from functools import wraps
from ..models import Customer
from .carrier_company import CarrierCompany as CarrierCompanyEntity
from .errors import bad_request, unauthorized

def token_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        auth_headers = request.headers.get('Authorization', '').split()
        if not auth_headers:
            return unauthorized('Missing token')
        customer = Customer.verify_auth_token(auth_headers[1])
        if customer is not None:
            return func(*args, **kwargs)
        return bad_request('Invalid token')
    return wrapper

def carrier_company_token_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        auth_headers = request.headers.get('Authorization', '').split()
        if not auth_headers:
            return unauthorized('Missing token')
        data = CarrierCompanyEntity.verify_carrier_company_token(auth_headers[1])
        if data is not None:
            return func(*args, **kwargs)
        return bad_request('Invalid token')
    return wrapper