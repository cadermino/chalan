"""Avisos push del navegador al cliente: "llegó una cotización".

El correo de nueva cotización sigue saliendo, pero el WhatsApp depende de
Twilio, que se quedó sin crédito (noviembre de 2026): el cliente se enteraba
por correo o cuando Carlos le escribía a mano. En el paso 3, mientras su orden
espera cotizaciones, el cliente puede tocar "Activar avisos"
(`frontend/src/components/carrierCompany/PushOptIn.vue` con `audience="customer"`)
y desde entonces su celular recibe un aviso por cada cotización nueva, aunque
tenga el navegador cerrado.

- Mismo service worker, claves y envío que los avisos a transportistas
  (`carrier_push.py`); la tabla es otra (`customer_push_subscriptions`, migración
  057) y el dueño es el cliente de la sesión, no una empresa.
- El aviso abre el link de acceso de la orden (`/acceso/<token>?r=push`), que
  entra sin contraseña aunque la sesión de 24 horas haya vencido. `r=push`
  cuenta en GA4 como `reminder_opened` con `channel: push` y marca la visita,
  así que elegir y agendar esa orden llegan con `reminder: push`.
- Un aviso por cotización, con el tag de la orden: el nuevo reemplaza al
  anterior en el celular (y vuelve a sonar).
- En iPhone solo funciona con el sitio en la pantalla de inicio, que casi ningún
  cliente hace: ahí la tarjeta no se muestra.
"""
from flask import jsonify, request

from . import api
from .carrier_push import parse_subscription, push_enabled, push_to_owners, save_subscription, _with_push_ref
from .decorators import token_required
from .order.order import customer_markup
from .order_access import order_access_url
from .quotation.quotation_status import QuotationStatus
from ..models import Customer, CustomerPushSubscription, Quotations

# Un cliente usa uno o dos celulares; más que esto es basura.
MAX_PER_CUSTOMER = 5


@api.route('/customer-push-subscriptions', methods=['POST'])
@token_required
def subscribe_customer_push():
    """Guarda el buzón de este navegador para el cliente de la sesión.

    Body: lo que da `PushSubscription.toJSON()` ({endpoint, keys: {p256dh, auth}})."""
    customer = Customer.verify_auth_token(request.headers.get('Authorization', '').split()[1])
    if not push_enabled():
        return jsonify({'message': 'push_disabled'}), 409
    parsed, error = parse_subscription(request.get_json(silent=True) or {})
    if error is not None:
        return error
    created = save_subscription(CustomerPushSubscription, 'customer_id', customer.id, *parsed, MAX_PER_CUSTOMER)
    return jsonify({'subscribed': True}), 201 if created else 200


def new_quotation_message(order, quotation):
    """"Nueva cotización para tu orden 343" · "S/ 418. Ya tienes 3: toca para compararlas."

    El monto es el que ve el cliente (con la comisión), redondeado a soles."""
    total = round(quotation.amount * customer_markup(order.id))
    live = Quotations.query.filter(Quotations.order_id == order.id,
                                   Quotations.quotation_status_id != QuotationStatus.Cancelled()).count()
    action = f'Ya tienes {live}: toca para compararlas.' if live > 1 else 'Toca para verla.'
    return {
        'title': f'Nueva cotización para tu orden {order.id}',
        'body': f'S/ {total:,}. {action}',
        'url': _with_push_ref(order_access_url(order)),
        'tag': f'customer-order-{order.id}',
    }


def notify_new_quotation(order, quotation):
    """Avisa al cliente de la orden. Nunca falla: es un aviso más junto al correo."""
    try:
        if order is None or not order.customer_id or not push_enabled():
            return 0
        return push_to_owners(CustomerPushSubscription, 'customer_id',
                              [(order.customer_id, new_quotation_message(order, quotation))])
    except Exception as e:
        print(f'[Push] Sin aviso al cliente de la orden {getattr(order, "id", None)}: {e}', flush=True)
        return 0
