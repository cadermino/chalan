"""Link corto para cotizar una orden: chalan.pe/c/<orden>-<empresa>-<firma>.

El link de cotizar de siempre lleva un JWT de unos 180 caracteres, y el
recordatorio por WhatsApp a cada transportista junta los de todas sus órdenes
pendientes. Este lleva solo los dos números y una firma corta (HMAC con
SECRET_KEY): no se puede cambiar un número para abrir otra orden o cotizar a
nombre de otra empresa. No vence: la página de cotizar mira el estado de la
orden. Next (`frontend-react/src/app/c/[code]/page.tsx`) lo canjea aquí por un
JWT nuevo y redirige a /quotation/<jwt>.

Las solicitudes de servicio tienen el suyo, chalan.pe/s/<solicitud>-<empresa>-<firma>
(otra sal, para que el código de una orden no abra la solicitud con el mismo
número): Next (`frontend-react/src/app/s/[code]/page.tsx`) lo canjea por el JWT
del link de siempre y redirige a /backoffice/carrier-view/<jwt>.

El backoffice-api arma los mismos códigos (`backoffice-api/app/quotation_short_link.py`):
si cambia el formato aquí, hay que cambiarlo allá.
"""
import base64
import hashlib
import hmac
import re

from flask import current_app, jsonify

from . import api
from .carrier_company import CarrierCompany as CarrierCompanyEntity
from .errors import not_found
from .order.order_status import OrderStatus
from .quotation.quotation_status import QuotationStatus
from .service_request.notifications import generate_service_request_token
from .service_request.statuses import PENDING, is_draft
from ..models import CarrierCompany, Order, ServiceRequest
from .. import db

SALT = b'quotation-short-link'
SERVICE_SALT = b'service-quotation-short-link'
SIGNATURE_LENGTH = 10
# Lo mismo que dura el link largo que va en el aviso.
TOKEN_SECONDS = 864000
_CODE = re.compile(r'^(\d+)-(\d+)-([A-Za-z0-9_-]+)$')


def _signature(order_id, carrier_company_id, salt=SALT):
    key = current_app.config['SECRET_KEY'].encode()
    digest = hmac.new(key, salt + f':{order_id}-{carrier_company_id}'.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode()[:SIGNATURE_LENGTH]


def make_code(order_id, carrier_company_id, salt=SALT):
    return f'{order_id}-{carrier_company_id}-{_signature(order_id, carrier_company_id, salt)}'


def make_service_code(service_request_id, carrier_company_id):
    return make_code(service_request_id, carrier_company_id, SERVICE_SALT)


def read_code(code, salt=SALT):
    """(order_id, carrier_company_id), o None si el código no es nuestro."""
    match = _CODE.match(code or '')
    if not match:
        return None
    order_id, carrier_company_id = int(match.group(1)), int(match.group(2))
    if not hmac.compare_digest(match.group(3), _signature(order_id, carrier_company_id, salt)):
        return None
    return order_id, carrier_company_id


@api.route('/quotation-links/<code>', methods=['GET'])
def redeem_quotation_short_link(code):
    ids = read_code(code)
    if ids is None:
        return not_found('link not found')
    order_id, carrier_company_id = ids
    order = db.session.get(Order, order_id)
    if order is None or db.session.get(CarrierCompany, carrier_company_id) is None:
        return not_found('link not found')
    # El código no vence: canjeado meses después seguía abriendo la dirección de
    # una orden cerrada. Sirve mientras se cotiza, o si la mudanza es suya.
    if order.order_status_id != OrderStatus.pending() and not order.quotations.filter_by(
            carrier_company_id=carrier_company_id, quotation_status_id=QuotationStatus.Selected()).first():
        return not_found('link not found')
    token = CarrierCompanyEntity().generate_carrier_company_token(TOKEN_SECONDS, order_id, carrier_company_id)
    return jsonify({'token': token}), 200


@api.route('/service-quotation-links/<code>', methods=['GET'])
def redeem_service_quotation_short_link(code):
    ids = read_code(code, SERVICE_SALT)
    if ids is None:
        return not_found('link not found')
    service_request_id, carrier_company_id = ids
    service_request = db.session.get(ServiceRequest, service_request_id)
    if service_request is None or is_draft(service_request) \
            or db.session.get(CarrierCompany, carrier_company_id) is None:
        return not_found('link not found')
    # Como el de las órdenes: mientras se cotiza, o si el trabajo es suyo.
    theirs = any(q.status == 'selected' and q.carrier_company_id == carrier_company_id
                 for q in service_request.quotations)
    if service_request.status != PENDING and not theirs:
        return not_found('link not found')
    return jsonify({'token': generate_service_request_token(service_request_id, carrier_company_id)}), 200
