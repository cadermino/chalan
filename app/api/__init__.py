from flask import Blueprint

api = Blueprint('api', __name__)

from . import products, orders, customers, errors, decorators, address