"""Avisos push del navegador a los transportistas (Web Push).

Prueba barata antes de una app: el transportista abre el link de cotizar
(`quotation.vue`), toca "Activar avisos" (`components/carrierCompany/PushOptIn.vue`)
y desde entonces su celular recibe, aunque tenga el navegador cerrado, los
mismos tres avisos que hoy van por correo y WhatsApp: orden nueva, la orden
cambió y "te eligieron". Al tocar el aviso se abre el link de siempre con
`?r=push`, que GA4 cuenta como `push_opened`. No reemplaza nada: el correo y el
WhatsApp siguen saliendo igual.

- Servicios (embalaje, armado, pintura…) igual: la tarjeta está en su link
  (`backoffice/src/pages/service-requests/CarrierView.jsx`, a través del
  backoffice-api) y avisan "nueva solicitud" y "te eligieron". Las dos páginas
  registran el mismo service worker (`/quotation/push-sw.js`), así que una
  empresa que hace mudanzas y servicios tiene una sola suscripción por celular.
- Pedir el permiso en el link de cotizar y no en el backoffice: ahí entra todos
  los días, y su token ya dice de qué empresa es, sin contraseña.
- Claves VAPID en el entorno (`WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`,
  `WEB_PUSH_SUBJECT`; `flask web-push-keys` arma un par). Sin ellas no se pide
  ni se manda nada. Cada entorno tiene las suyas, y solo se manda a las filas
  suscritas con la clave actual: una base copiada a local no le escribe a los
  celulares de producción.
- El servidor le hace un POST al `endpoint` que manda el navegador, así que
  solo se aceptan los servicios de push conocidos (`PUSH_HOSTS`), no cualquier
  URL.
- No llega a Huawei sin servicios de Google, y en iPhone solo desde iOS 16.4 y
  con el sitio agregado a la pantalla de inicio.
"""
import json
import os
import re
from datetime import datetime
from threading import Thread
from urllib.parse import urlsplit

from flask import current_app, jsonify, request

from . import api
from .address import district_of
from .carrier_company import CarrierCompany as CarrierCompanyEntity
from .errors import bad_request, not_found, unauthorized
from .order.load import LOAD_TYPE_LABELS
from ..models import CarrierCompany, CarrierPushSubscription
from .. import db

# El propósito del token del link de una solicitud de servicio
# (service_request/notifications.py, TOKEN_PURPOSE).
SERVICE_TOKEN_PURPOSE = 'service_request'

# Google (Chrome, Edge en Android, Samsung, Opera), Mozilla, Apple y Microsoft.
PUSH_HOSTS = ('fcm.googleapis.com', 'android.googleapis.com', 'push.services.mozilla.com',
              'push.apple.com', 'notify.windows.com')
_B64URL = re.compile(r'^[A-Za-z0-9_-]+={0,2}$')
MAX_ENDPOINT = 1000
# Un celular por persona, y una empresa con varios: más que esto es basura.
MAX_PER_COMPANY = 10
# Una orden nueva sigue sirviendo un día después; más, no.
TTL_SECONDS = 86400
# El servicio dice que el buzón ya no existe (borró datos, bloqueó los avisos).
GONE = {404, 410}
MAX_FAILURES = 5
PUSH_TIMEOUT = 10

_WEEKDAYS = ('lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom')
_MONTHS = ('ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic')


def public_key():
    return (os.getenv('WEB_PUSH_PUBLIC_KEY') or '').strip()


def _private_key():
    return (os.getenv('WEB_PUSH_PRIVATE_KEY') or '').strip()


def _subject():
    return (os.getenv('WEB_PUSH_SUBJECT') or '').strip() or 'mailto:carlos.calderon@chalan.pe'


def push_enabled():
    return bool(public_key() and _private_key())


def generate_keys():
    """Un par VAPID nuevo: (pública, privada), en base64url como las pide el navegador."""
    import base64
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec

    def b64(raw):
        return base64.urlsafe_b64encode(raw).rstrip(b'=').decode()

    key = ec.generate_private_key(ec.SECP256R1())
    private = key.private_numbers().private_value.to_bytes(32, 'big')
    public = key.public_key().public_bytes(serialization.Encoding.X962,
                                           serialization.PublicFormat.UncompressedPoint)
    return b64(public), b64(private)


# --- Suscribirse -------------------------------------------------------------

@api.route('/web-push/public-key', methods=['GET'])
def web_push_public_key():
    """La clave con que el navegador se suscribe; null si los avisos están apagados."""
    return jsonify({'public_key': public_key() if push_enabled() else None}), 200


def _is_carrier_link(data):
    """Si el token es el de un link para cotizar: el de una orden (empresa y
    orden, sin propósito) o el de una solicitud de servicio (`service_request`).

    Todos los JWT de las dos apps comparten SECRET_KEY, y los de reseña también
    traen la empresa (y la orden o la solicitud): con uno, un cliente
    suscribiría su navegador a los avisos de esa empresa y recibiría sus links
    para cotizar. Los de reseña llevan `purpose: review`, y los de mudanza de
    antes de octubre de 2026, `customer_id`."""
    if not data or not data.get('carrier_company_id') or 'customer_id' in data:
        return False
    purpose = data.get('purpose')
    if purpose is None:
        return bool(data.get('order_id'))
    return purpose == SERVICE_TOKEN_PURPOSE and bool(data.get('service_request_id'))


def _company_from_link():
    """La empresa del token del link para cotizar, o (None, respuesta de error)."""
    parts = request.headers.get('Authorization', '').split()
    if len(parts) < 2:
        return None, unauthorized('Missing token')
    data = CarrierCompanyEntity.verify_carrier_company_token(parts[1])
    if not _is_carrier_link(data):
        return None, bad_request('Invalid token')
    company = db.session.get(CarrierCompany, data['carrier_company_id'])
    if company is None:
        return None, not_found('carrier company not found')
    return company, None


def _key(value, low, high):
    return isinstance(value, str) and low <= len(value) <= high and bool(_B64URL.match(value))


def _known_push_service(endpoint):
    parts = urlsplit(endpoint)
    host = (parts.hostname or '').lower()
    return parts.scheme == 'https' and any(host == h or host.endswith('.' + h) for h in PUSH_HOSTS)


@api.route('/carrier-push-subscriptions', methods=['POST'])
def subscribe_carrier_push():
    """Guarda el buzón de este navegador para la empresa del link.

    Body: lo que da `PushSubscription.toJSON()` ({endpoint, keys: {p256dh, auth}}).
    Llamarlo otra vez con el mismo buzón lo actualiza (y lo pasa a esta empresa,
    si el celular abrió el link de otra)."""
    company, error = _company_from_link()
    if error is not None:
        return error
    if not push_enabled():
        return jsonify({'message': 'push_disabled'}), 409

    body = request.get_json(silent=True) or {}
    endpoint = body.get('endpoint')
    keys = body.get('keys') if isinstance(body.get('keys'), dict) else {}
    if not isinstance(endpoint, str) or len(endpoint) > MAX_ENDPOINT:
        return bad_request('invalid_endpoint')
    if not _known_push_service(endpoint):
        return bad_request('unsupported_push_service')
    if not _key(keys.get('p256dh'), 80, 200) or not _key(keys.get('auth'), 16, 100):
        return bad_request('invalid_keys')

    now = datetime.utcnow()
    subscription = CarrierPushSubscription.query.filter_by(endpoint=endpoint).first()
    created = subscription is None
    if created:
        subscription = CarrierPushSubscription(endpoint=endpoint, created_date=now)
        db.session.add(subscription)
    subscription.carrier_company_id = company.id
    subscription.p256dh = keys['p256dh']
    subscription.auth = keys['auth']
    subscription.vapid_public_key = public_key()
    subscription.user_agent = (request.headers.get('User-Agent') or '')[:300] or None
    subscription.updated_date = now
    subscription.failure_count = 0
    subscription.last_error = None
    db.session.flush()

    extra = CarrierPushSubscription.query.filter_by(carrier_company_id=company.id) \
        .order_by(CarrierPushSubscription.updated_date.desc(), CarrierPushSubscription.id.desc()) \
        .offset(MAX_PER_COMPANY).all()
    for old in extra:
        db.session.delete(old)
    db.session.commit()
    return jsonify({'subscribed': True}), 201 if created else 200


# --- Mandar ------------------------------------------------------------------

def _with_push_ref(url):
    return url + ('&' if '?' in url else '?') + 'r=push'


def _short_date(value):
    if not value:
        return None
    return f'{_WEEKDAYS[value.weekday()]} {value.day} {_MONTHS[value.month - 1]}'


def _district(order, kind):
    detail = order.order_details.filter_by(type=kind).first()
    if detail is None:
        return None
    return district_of({'street': detail.street, 'neighborhood': detail.neighborhood, 'city': detail.city})


def order_summary(order):
    """"sáb 29 nov · Miraflores → Surco · Mudanza": lo que cabe en un aviso.

    Nunca falla: se arma dentro del bucle que manda los correos a cada
    transportista, y un dato raro no puede cortar ese envío."""
    try:
        route = ' → '.join(filter(None, [_district(order, 'carry_from'), _district(order, 'deliver_to')]))
        load = LOAD_TYPE_LABELS.get(order.load_type or 'moving')
        return ' · '.join(filter(None, [_short_date(order.appointment_date), route, load]))
    except Exception as e:
        print(f'[Push] Sin resumen de la orden {getattr(order, "id", None)}: {e}', flush=True)
        return ''


def _message(order, title, action, url):
    summary = order_summary(order)
    return {'title': title, 'body': f'{summary}. {action}' if summary else action,
            'url': _with_push_ref(url), 'tag': f'order-{order.id}'}


def new_order_message(order, quotation_url, changed=False):
    if changed:
        return _message(order, f'La orden {order.id} cambió', 'Vuelve a cotizar.', quotation_url)
    return _message(order, f'Nueva orden {order.id} para cotizar', 'Toca para cotizar.', quotation_url)


def selected_message(order, orders_url):
    return _message(order, f'¡Te eligieron! Orden {order.id}', 'Toca para ver los datos del cliente.', orders_url)


def _service_summary(service_request):
    """"sáb 29 nov · Miraflores": la fecha y el distrito de una solicitud. Nunca falla."""
    try:
        district = district_of({'street': service_request.street, 'neighborhood': service_request.neighborhood,
                                'city': service_request.city})
        return ' · '.join(filter(None, [_short_date(service_request.preferred_date), district]))
    except Exception as e:
        print(f'[Push] Sin resumen de la solicitud {getattr(service_request, "id", None)}: {e}', flush=True)
        return ''


def _service_name(service_request):
    service_type = getattr(service_request, 'service_type', None)
    return (service_type.name if service_type else 'servicio').lower()


def _service_message(service_request, title, action, url):
    summary = _service_summary(service_request)
    return {'title': title, 'body': f'{summary}. {action}' if summary else action,
            'url': _with_push_ref(url), 'tag': f'service-{service_request.id}'}


def new_service_message(service_request, carrier_url):
    return _service_message(service_request, f'Nueva solicitud {service_request.id} de {_service_name(service_request)}',
                            'Toca para cotizar.', carrier_url)


def service_selected_message(service_request, carrier_url):
    return _service_message(service_request, f'¡Te eligieron! {_service_name(service_request).capitalize()}, solicitud {service_request.id}',
                            'Toca para ver los datos del cliente.', carrier_url)


def notify_carriers(messages, wait=False):
    """Manda cada mensaje a los navegadores suscritos de su empresa.

    `messages`: [(carrier_company_id, {title, body, url, tag})]. Devuelve a
    cuántos navegadores salió. Nunca falla: es un aviso más, junto al correo y
    el WhatsApp. Se manda en un hilo, como el WhatsApp, para no demorar la
    respuesta (en los tests, en el mismo). `wait`: mandarlo antes de volver,
    para un comando de consola, que termina sin esperar al hilo."""
    try:
        if not messages or not push_enabled():
            return 0
        by_company = {}
        for company_id, message in messages:
            by_company.setdefault(company_id, []).append(message)
        rows = CarrierPushSubscription.query.filter(
            CarrierPushSubscription.carrier_company_id.in_(list(by_company)),
            CarrierPushSubscription.vapid_public_key == public_key(),
        ).all()
        targets = [
            (row.id, {'endpoint': row.endpoint, 'keys': {'p256dh': row.p256dh, 'auth': row.auth}},
             json.dumps(message, ensure_ascii=False))
            for row in rows for message in by_company[row.carrier_company_id]
        ]
        if not targets:
            return 0
        if wait or current_app.config.get('TESTING'):
            _deliver(targets)
        else:
            app = current_app._get_current_object()
            Thread(target=_deliver_in_thread, args=(app, targets), daemon=True).start()
        return len(targets)
    except Exception as e:
        print(f'[Push] Error al preparar avisos: {e}', flush=True)
        return 0


def notify_carrier(carrier_company_id, message, wait=False):
    return notify_carriers([(carrier_company_id, message)], wait=wait)


def _send(subscription_info, payload):
    """Un aviso. Devuelve (código HTTP o None si no hubo respuesta, error o None)."""
    from pywebpush import WebPushException, webpush
    try:
        response = webpush(
            subscription_info=subscription_info,
            data=payload.encode('utf-8'),
            vapid_private_key=_private_key(),
            vapid_claims={'sub': _subject()},
            ttl=TTL_SECONDS,
            headers={'Urgency': 'high'},
            timeout=PUSH_TIMEOUT,
        )
        return getattr(response, 'status_code', 201), None
    except WebPushException as e:
        status = e.response.status_code if e.response is not None else None
        return status, str(e)
    except Exception as e:
        return None, str(e)


def _deliver_in_thread(app, targets):
    with app.app_context():
        _deliver(targets)


def _deliver(targets):
    for subscription_id, subscription_info, payload in targets:
        status, error = _send(subscription_info, payload)
        try:
            row = db.session.get(CarrierPushSubscription, subscription_id)
            if row is None:
                continue
            if error is None:
                row.last_sent_at = datetime.utcnow()
                row.failure_count = 0
                row.last_error = None
            elif status in GONE or (row.failure_count or 0) + 1 >= MAX_FAILURES:
                print(f'[Push] Borrada la suscripción {subscription_id}: {status} {error[:120]}', flush=True)
                db.session.delete(row)
            else:
                row.failure_count = (row.failure_count or 0) + 1
                row.last_error = f'{status or ""} {error}'.strip()[:200]
                print(f'[Push] Falló la suscripción {subscription_id}: {row.last_error}', flush=True)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f'[Push] Error al guardar el envío {subscription_id}: {e}', flush=True)
