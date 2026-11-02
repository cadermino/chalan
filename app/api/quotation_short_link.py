"""Link corto para cotizar una orden: chalan.pe/c/<orden>-<empresa>-<firma>.

El link de cotizar de siempre lleva un JWT de unos 180 caracteres, y el
recordatorio por WhatsApp a cada transportista junta los de todas sus órdenes
pendientes. Este lleva solo los dos números y una firma corta (HMAC con
SECRET_KEY): no se puede cambiar un número para abrir otra orden o cotizar a
nombre de otra empresa. No vence: la página de cotizar mira el estado de la
orden. Next (`frontend-react/src/app/c/[code]/page.tsx`) lo canjea aquí por un
JWT nuevo y redirige a /quotation/<jwt>.

El backoffice-api arma el mismo código (`backoffice-api/app/quotation_short_link.py`):
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
from ..models import CarrierCompany, Order
from .. import db

SALT = b'quotation-short-link'
SIGNATURE_LENGTH = 10
# Lo mismo que dura el link largo que va en el aviso.
TOKEN_SECONDS = 864000
_CODE = re.compile(r'^(\d+)-(\d+)-([A-Za-z0-9_-]+)$')


def _signature(order_id, carrier_company_id):
    key = current_app.config['SECRET_KEY'].encode()
    digest = hmac.new(key, SALT + f':{order_id}-{carrier_company_id}'.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode()[:SIGNATURE_LENGTH]


def make_code(order_id, carrier_company_id):
    return f'{order_id}-{carrier_company_id}-{_signature(order_id, carrier_company_id)}'


def read_code(code):
    """(order_id, carrier_company_id), o None si el código no es nuestro."""
    match = _CODE.match(code or '')
    if not match:
        return None
    order_id, carrier_company_id = int(match.group(1)), int(match.group(2))
    if not hmac.compare_digest(match.group(3), _signature(order_id, carrier_company_id)):
        return None
    return order_id, carrier_company_id


@api.route('/quotation-links/<code>', methods=['GET'])
def redeem_quotation_short_link(code):
    ids = read_code(code)
    if ids is None:
        return not_found('link not found')
    order_id, carrier_company_id = ids
    if db.session.get(Order, order_id) is None or db.session.get(CarrierCompany, carrier_company_id) is None:
        return not_found('link not found')
    token = CarrierCompanyEntity().generate_carrier_company_token(TOKEN_SECONDS, order_id, carrier_company_id)
    return jsonify({'token': token}), 200
