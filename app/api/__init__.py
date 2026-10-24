from flask import Blueprint

api = Blueprint('api', __name__)

from . import orders, customers, errors, decorators, quotations, carrierCompany, reviews, whatsapp_webhook, chat, service_requests, carrier_documents, order_videos, vehicle_photos