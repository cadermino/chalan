from flask import Blueprint

api = Blueprint('api', __name__)

from . import users, carrier_companies, vehicles, orders, customers, whatsapp, dashboard, service_requests  # noqa: F401, E402
