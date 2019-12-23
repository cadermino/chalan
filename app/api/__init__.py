from flask import Blueprint

api = Blueprint('api', __name__)

from . import authentication, orders, customers, errors, decorators