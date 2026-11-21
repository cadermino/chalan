from flask import Blueprint

api = Blueprint('api', __name__)

from . import users, carrier_companies, vehicles, orders, customers, whatsapp, dashboard, service_requests, carrier_documents, carrier_rates, auto_quote, formal_quotations  # noqa: F401, E402
