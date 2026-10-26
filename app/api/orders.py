import os
import re
import base64
import uuid
from flask import jsonify, request, current_app
from openai import OpenAI
from ..models import Customer, Order, OrderImage, OrderImageSchema, AdminUser, ReferredOrder
from ..models import Payment as PaymentModel
from ..models import Quotations as QuotationsModel
from ..models import CarrierCompanySchema, QuotationsSchema
from ..models import CarrierCompany as CarrierCompanyModel
from ..models import CarrierCompanyServiceType, ServiceType, MOVING_SERVICE_CODE
from . import api
from .decorators import (token_required, carrier_company_token_required,
                         authenticated_customer, is_internal_request)
from .order import Order as OrderEntity
from .order.order import yape_reservation_required
from .order.order_status import OrderStatus
from .order.load import needs_cargo_weight
from .order.steps.addresses import Addresses as AddressesStep
from .order.steps.belongings_appointment_date import BelongingsAppointmentDate as BelongingsAppointmentDateStep
from .quotation import Quotation as QuotationEntity
from .quotation.quotation_status import QuotationStatus
from .carrier_declines import decline_to_dict, find_order_decline
from .operation_numbers import clean_operation_number, is_valid_operation_number, operation_number_in_use

from .carrier_company import CarrierCompany as CarrierCompanyEntity
from .email import send_email
from .whatsapp import send_whatsapp, normalize_phone
from datetime import date, datetime, timedelta, timezone
from .errors import not_found
from .. import db
from ..storage import get_storage

CARRIER_NOTIFICATION_COOLDOWN = timedelta(minutes=15)
# Perú no tiene horario de verano, así que un offset fijo alcanza y evita
# depender de que la imagen traiga la base de zonas horarias.
LIMA_TZ = timezone(timedelta(hours=-5))

@api.route('/order', methods=['POST'])
def create_order():
    order_data = request.json or {}
    customer = order_data.get('customer')
    missing = []
    if not isinstance(customer, dict) or 'customer_id' not in customer:
        missing.append('customer.customer_id')
    if not order_data.get('orderDetailsOrigin'):
        missing.append('orderDetailsOrigin')
    if not order_data.get('orderDetailsDestination'):
        missing.append('orderDetailsDestination')
    if missing:
        return jsonify({'message': 'missing required fields: ' + ', '.join(missing)}), 400

    order = OrderEntity()
    order = order.create(request=order_data)

    # Link order to referring real_estate_agent if referral_code is present
    referral_code = order_data.get('referral_code')
    if referral_code:
        agent = AdminUser.query.filter_by(
            referral_code=referral_code, role='real_estate_agent'
        ).first()
        if agent:
            ref = ReferredOrder(admin_user_id=agent.id, order_id=order.id)
            db.session.add(ref)
            db.session.commit()

    return jsonify({
        'message': 'order {id} created!'.format(id=order.id),
        'order_id': order.id,
    }), 201

@api.route('/order/<int:order_id>/lead-phone', methods=['PUT'])
def save_lead_phone(order_id):
    order = db.session.get(Order, order_id)
    if order is None:
        return not_found('order not found')
    data = request.json or {}
    order.lead_phone = data.get('lead_phone')
    db.session.commit()
    return jsonify({'order_id': order.id}), 200

@api.route('/order/<int:order_id>', methods=['PUT'])
def update_order(order_id):
    order_data = request.json or {}

    # Esta ruta sale a internet por `location /api` del nginx, no solo por la
    # red interna de Docker. Sin esto aceptaba cualquier `customer.customer_id`
    # del cuerpo sin pedir nada: mandar el id de otra persona reasignaba la
    # orden, y como GET /order/<id> filtra por pertenencia, el nuevo dueño
    # pasaba a ver la dirección completa y el teléfono del original. Los ids de
    # orden son correlativos, así que no había ni que adivinarlos.
    db_order = db.session.get(Order, order_id)
    if db_order is None:
        return jsonify({'message': 'order not found'}), 404

    internal = is_internal_request()
    authenticated = None if internal else authenticated_customer()

    if db_order.customer_id is not None and not internal:
        # La orden ya tiene dueño: solo él la toca.
        if authenticated is None or authenticated.id != db_order.customer_id:
            return jsonify({'message': 'forbidden'}), 403

    # Una orden todavía sin dueño (el visitante que va por el paso 1 y aún no
    # se registró) sigue siendo editable sin sesión, porque así funciona el
    # formulario. Lo que ya no se acepta es que el cuerpo diga a quién
    # pertenece: eso sale del token o no pasa nada.
    customer = order_data.get('customer')
    order_fields = order_data.get('order')
    missing = []
    if not isinstance(customer, dict) or 'customer_id' not in customer:
        missing.append('customer.customer_id')
    if not isinstance(order_fields, dict):
        missing.append('order')
    else:
        missing.extend(
            f'order.{field}' for field in ('appointment_date', 'comments', 'approximate_budget')
            if field not in order_fields
        )
    origin = order_data.get('orderDetailsOrigin')
    if not isinstance(origin, dict):
        missing.append('orderDetailsOrigin')
    else:
        missing.extend(
            f'orderDetailsOrigin.{field}' for field in
            ('from_street', 'from_floor_number', 'from_country', 'from_map_url')
            if field not in origin
        )
    destination = order_data.get('orderDetailsDestination')
    if not isinstance(destination, dict):
        missing.append('orderDetailsDestination')
    else:
        missing.extend(
            f'orderDetailsDestination.{field}' for field in
            ('to_street', 'to_floor_number', 'to_country', 'to_map_url')
            if field not in destination
        )
    services = order_data.get('services')
    if not isinstance(services, dict):
        missing.append('services')
    else:
        missing.extend(
            f'services.{field}' for field in ('cargo', 'packaging')
            if field not in services
        )
    if missing:
        return jsonify({'message': 'missing required fields: ' + ', '.join(missing)}), 400

    # Un llamador interno es el backoffice-api, no un navegador: manda el cuerpo
    # entero a proposito y siempre quiere escribirlo. Si llega sin la marca es
    # un bug de programacion nuestro, no un login reenviando localStorage, y
    # controlamos las dos puntas. Devolverlo en 400 evita que se repita lo de
    # 02e8f88, que dejo cuatro dias de ordenes vacias respondiendo 200.
    if internal and not order_data.get('orderEditedByCustomer'):
        return jsonify({
            'message': 'internal callers must send orderEditedByCustomer'
        }), 400

    address_changed = AddressesStep(order_id).has_changed(order_data)
    belongings_changed = BelongingsAppointmentDateStep(order_id).has_changed(order_data)
    data_changed = address_changed or belongings_changed
    # El dueño sale del token, nunca del cuerpo. Una llamada interna (el
    # backoffice, que ya validó el rol de quien la hizo) conserva el que la
    # orden ya tenga.
    owner_id = db_order.customer_id
    if internal:
        # El backoffice ya validó el rol de quien pide, y reasignar el cliente
        # de una orden es una de sus funciones, así que ahí sí se le cree.
        owner_id = (order_data.get('customer') or {}).get('customer_id') or owner_id
    elif authenticated is not None:
        owner_id = authenticated.id

    # Quién puede escribir ya está resuelto arriba; esto decide qué se escribe.
    # Solo el formulario de la mudanza (pasos 1 y 2) reescribe los datos de la
    # orden. El resto de los PUT —login, registro, el paso 3 al pedir
    # cotizaciones, el modal de pago— reenvían lo que quedó en el localStorage
    # del navegador, que puede ser más viejo que la base si alguien corrigió la
    # orden desde el backoffice. De esos solo se toma ligar al cliente.
    order_entity = OrderEntity(order_id)
    if order_data.get('orderEditedByCustomer'):
        order = order_entity.update(request=order_data, customer_id=owner_id)
        written = 'full'
    else:
        order = order_entity.link_customer(owner_id)
        written = 'customer_link'
        if data_changed:
            # El cuerpo traia datos distintos a los guardados y se descartaron
            # enteros. Para login, registro y el modal de pago eso es lo
            # correcto —reenvian una copia vieja del navegador— pero es tambien
            # la firma exacta de un cliente que cree estar guardando y no lo
            # esta. Sin esta linea el unico sintoma es un 200.
            current_app.logger.warning(
                'PUT /order/%s sin orderEditedByCustomer descarto cambios '
                '(direcciones=%s, mudanza=%s)',
                order_id, address_changed, belongings_changed,
            )

    # Solo cancela cuando el cliente editó su mudanza en los pasos 1 o 2. Antes
    # bastaba cualquier PUT sin `requestQuotationFromCarrierCompany`, y eso
    # incluía el de Login/Register, que reenvía la orden tal como quedó en el
    # localStorage del navegador: bastaba que la clienta volviera a entrar para
    # que sus cotizaciones vivas se cancelaran solas. Si falta la marca no se
    # cancela nada, que es el lado seguro del error.
    if order_data.get('orderEditedByCustomer') and data_changed:
        db_order = db.session.get(Order, order_id)
        recently_notified = (
            db_order and db_order.carrier_notified_at and
            datetime.utcnow() - db_order.carrier_notified_at < CARRIER_NOTIFICATION_COOLDOWN
        )
        if db_order and db_order.quotation_requested and not recently_notified:
            db_order.quotation_requested = False
            QuotationsModel.query.filter(
                QuotationsModel.order_id == order_id,
                QuotationsModel.quotation_status_id != QuotationStatus.Cancelled()
            ).update({'quotation_status_id': QuotationStatus.Cancelled()})
            db.session.commit()

    emails_sent = send_email_to_carrier_companies(order_id, order_data)
    # El mensaje dejo de decir "updated!" pase lo que pase: un PUT que solo
    # ligo al cliente no actualizo la orden. `written` y `fields_written` son
    # aditivos —ningun cliente actual los lee, todos miran el status— y le dan
    # al backoffice y al agente externo algo contra que afirmar.
    message = (
        'order {id} updated!' if written == 'full' else 'order {id} linked to customer'
    ).format(id=order.id)
    return jsonify({
        'message': message,
        'order_id': order.id,
        'written': written,
        'fields_written': order_entity.written_fields,
        'emails_sent_by_company_id': emails_sent
    }), 200

@api.route('/orders/details', methods=['GET'])
@carrier_company_token_required
def order_detail():
    auth_headers = request.headers.get('Authorization', '').split()
    data = CarrierCompanyEntity.verify_carrier_company_token(auth_headers[1])
    order = OrderEntity(data['order_id'])
    order_details = order.details()
    quotations = QuotationEntity().listByOrderId(data['order_id'])
    order_details['quotations'] = QuotationsSchema(many=True).dump(quotations.quotations)
    # Su propia nota, para recotizar sin reescribirla; las de los demás no.
    for dumped, quotation in zip(order_details['quotations'], quotations.quotations):
        if quotation.carrier_company_id == data['carrier_company_id']:
            dumped['note'] = quotation.note

    if order_details.get('approximate_budget'):
        platform_fee = float(os.getenv('PLATFORM_FEE'))
        commission_rate = 0
        referred = ReferredOrder.query.filter_by(order_id=data['order_id']).first()
        if referred:
            agent = db.session.get(AdminUser, referred.admin_user_id)
            commission_rate = agent.commission_rate
        order_details['approximate_budget'] = round(
            order_details['approximate_budget'] / (1 + commission_rate + platform_fee), 2
        )

    company = db.session.get(CarrierCompanyModel, data['carrier_company_id'])
    return jsonify({
        'order': order_details,
        'carrier_company_id': data['carrier_company_id'],
        # Para etiquetar la grabación de la visita (quotation.vue): es su propio nombre.
        'carrier_company_name': company.name if company else None,
        'decline': decline_to_dict(find_order_decline(data['order_id'], data['carrier_company_id'])),
    }), 200

@api.route('/order/<int:order_id>', methods=['GET'])
@token_required
def get_order(order_id):
    auth_headers = request.headers.get('Authorization', '').split()
    customer = Customer.verify_auth_token(auth_headers[1])
    order = customer.orders.filter_by(id = order_id).first()
    if order is not None:
        order_detail = OrderEntity(order_id).details()
    else:
        return not_found('order not found')
    return jsonify({
        'order': order_detail,
    }), 200

def _ops_recipient():
    return os.getenv('OPS_MAIL') if os.getenv('FLASK_ENV') == 'prod' else os.getenv('ADMIN_MAIL')


def _contact_details(customer, carrier_company):
    """Nombre y teléfono de las dos partes, para que se escriban entre ellas.

    Chalán no hace de intermediario después de agendar: el cliente y el
    transportista coordinan directo. Cada correo muestra solo los datos de la
    otra parte (cada uno ya sabe los suyos), pero los dos reciben el diccionario
    completo y la plantilla elige. El enlace de WhatsApp solo se arma si el
    teléfono se puede normalizar; si no, queda el número a secas.
    """
    def whatsapp_url(phone):
        e164 = normalize_phone(phone)
        return 'https://wa.me/' + e164.lstrip('+') if e164 else None

    return {
        'customer_full_name': ' '.join(filter(None, [customer.name, customer.paternal_last_name])),
        'customer_phone': customer.mobile_phone,
        'customer_whatsapp_url': whatsapp_url(customer.mobile_phone),
        'carrier_name': carrier_company.name,
        'carrier_phone': carrier_company.phone,
        'carrier_whatsapp_url': whatsapp_url(carrier_company.phone),
    }


def _send_order_scheduled_emails(order, customer, quotation, reservation=None):
    """Los dos correos que dicen "la mudanza quedó agendada".

    Salen cuando la orden pasa a in_progress: al agendar si no hay reserva que
    verificar, o al confirmar el yapeo desde el backoffice si la hay. Con
    `reservation` el correo al cliente suma los datos del pago como comprobante.
    Ambos llevan los datos de contacto de las dos partes.
    """
    site_url = os.getenv('SITE_URL')
    carrier_company = quotation.carrier_company
    carrier_company_orders_url = CarrierCompanyEntity(carrier_company.id).generate_orders_url(order.id, site_url)

    bcc = [os.getenv('OPS_MAIL')] if os.getenv('FLASK_ENV') == 'prod' else [os.getenv('ADMIN_MAIL')]
    contact = _contact_details(customer, carrier_company)

    send_email(
        carrier_company.email,
        '[Pago en efectivo] Orden {} '.format(order.id),
        'email/admin_new_order',
        bcc=bcc,
        carrier_company_orders_url=carrier_company_orders_url,
        **contact,
    )
    receipt = {}
    if reservation is not None:
        receipt = {
            'reservation_amount': '{:.2f}'.format(reservation.amount),
            'operation_number': reservation.reference,
            'carrier_amount': '{:.2f}'.format(round(quotation.amount, 2)),
        }
    send_email(
        customer.email,
        'Hemos agendado tu mudanza!',
        'email/cash_payment_selected',
        bcc=[],
        customer_name=customer.name,
        mobile_phone=customer.mobile_phone,
        **contact,
        **receipt,
    )


def _send_reservation_emails(order, customer, quotation, reservation):
    """Avisa que hay un yapeo por verificar: a operaciones y al cliente.

    La orden sigue en pending; el transportista no se entera hasta que un admin
    confirme la reserva (confirm_reservation).
    """
    customer_name = ' '.join(filter(None, [customer.name, customer.paternal_last_name]))
    send_email(
        _ops_recipient(),
        '[Yape por verificar] Orden {}'.format(order.id),
        'email/yape_reservation_submitted',
        bcc=[],
        order_id=order.id,
        customer_name=customer_name,
        customer_email=customer.email,
        customer_phone=customer.mobile_phone,
        carrier_name=quotation.carrier_company.name,
        reservation_amount='{:.2f}'.format(reservation.amount),
        operation_number=reservation.reference,
        submitted_at=datetime.now(LIMA_TZ).strftime('%d/%m/%Y %H:%M'),
    )
    send_email(
        customer.email,
        'Recibimos tu pago',
        'email/yape_reservation_received',
        bcc=[],
        customer_name=customer.name,
        reservation_amount='{:.2f}'.format(reservation.amount),
        operation_number=reservation.reference,
        carrier_amount='{:.2f}'.format(round(quotation.amount, 2)),
    )


def _reservation_of(order_id, quotation_id):
    """La reserva viva de la cotización elegida, o None si no tiene."""
    return PaymentModel.query.filter(
        PaymentModel.order_id == order_id,
        PaymentModel.concept == 'reservation',
        PaymentModel.status != 'cancelled',
        db.or_(PaymentModel.quotation_id == quotation_id,
               PaymentModel.quotation_id.is_(None)),
    ).order_by(PaymentModel.id.desc()).first()


@api.route('/order/checkout-cash/<int:order_id>', methods=['PUT'])
@token_required
def generate_checkout_cash(order_id):
    auth_headers = request.headers.get('Authorization', '').split()
    customer = Customer.verify_auth_token(auth_headers[1])
    order_entity = OrderEntity(order_id)
    order_model = order_entity.query_orders({'id': order_id})
    quotation = order_model[0].quotations.filter_by(quotation_status_id = 2).first()

    # Con la exigencia activa, agendar pide yapear la reserva e informar su
    # número de operación. Se valida acá y no solo en el modal: sin esto basta
    # llamar al endpoint directo para agendar sin pagar.
    breakdown = OrderEntity.reservation_breakdown(quotation)
    requires_reservation = yape_reservation_required() and breakdown['reservation_amount'] > 0
    operation_number = clean_operation_number((request.get_json(silent=True) or {}).get('operation_number'))
    valid_number = is_valid_operation_number(operation_number)
    if requires_reservation:
        if not valid_number:
            return jsonify({'message': 'invalid_operation_number'}), 400
        # Un mismo yapeo no puede agendar dos órdenes, ni una orden y una
        # solicitud de servicio.
        if operation_number_in_use(operation_number, order_id=order_id):
            return jsonify({'message': 'operation_number_already_used'}), 409

    payment, created = order_entity.create_order_payments(
        reference=operation_number if valid_number else None
    )

    # Los correos solo salen cuando la orden se agendó en esta llamada. Volver
    # atrás desde el dashboard y confirmar de nuevo reenviaba ambos: el
    # transportista recibía dos veces el mismo pedido y el cliente dos
    # confirmaciones de la misma mudanza.
    if created:
        db_order = db.session.get(Order, order_id)
        reservation = _reservation_of(order_id, quotation.id)
        if requires_reservation:
            # La orden sigue en pending hasta que un admin confirme el yapeo en
            # el backoffice (confirm_reservation). Hasta entonces el
            # transportista no la ve en su lista ni recibe el pedido.
            _send_reservation_emails(db_order, customer, quotation, reservation)
        else:
            # Agendar es lo que pone la orden en marcha, asi que el estado se
            # escribe aca. Antes lo hacia el PUT del modal de pago, que desde
            # 02e8f88 no escribe nada: la orden se quedaba en pending aunque
            # estuviera agendada y cobrada, y con eso el transportista no la veia
            # en su lista (carrierCompany.py:43), no podia marcarla completada
            # (backoffice-api/app/api/orders.py:847) y el guard de quotations.py:99
            # seguia dejando elegir otra cotizacion. `created` ya garantiza que
            # esto corre una sola vez por orden.
            if db_order is not None and db_order.order_status_id == OrderStatus.pending():
                db_order.order_status_id = OrderStatus.in_progress()
                db.session.commit()
            _send_order_scheduled_emails(db_order, customer, quotation)

    order_now = db.session.get(Order, order_id)
    return jsonify({
        'payment': payment.id,
        'created': created,
        'awaiting_verification': bool(
            requires_reservation and order_now.order_status_id == OrderStatus.pending()
        ),
    }), 200


@api.route('/order/<int:order_id>/confirm-reservation', methods=['POST'])
def confirm_reservation(order_id):
    """Pone la orden en marcha cuando un admin confirmó el yapeo de la reserva.

    Lo llama el backoffice-api al marcar la reserva como pagada; el control de
    rol ya se hizo allá. Es el momento en que el transportista se entera: hasta
    acá la orden estaba en pending esperando la verificación.

    Idempotente: si la orden ya no está pending (confirmada antes, completada o
    cancelada) no hace nada ni reenvía correos.
    """
    if not is_internal_request():
        return jsonify({'message': 'forbidden'}), 403
    order = db.session.get(Order, order_id)
    if order is None:
        return not_found('order not found')
    if order.order_status_id != OrderStatus.pending():
        return jsonify({'confirmed': False}), 200

    quotation = order.quotations.filter_by(quotation_status_id=QuotationStatus.Selected()).first()
    if quotation is None:
        # Sin cotización elegida no hay transportista a quien avisar; mejor
        # dejar la orden como está que ponerla en marcha sin dueño.
        return jsonify({'message': 'no_selected_quotation'}), 409
    customer = db.session.get(Customer, order.customer_id)

    order.order_status_id = OrderStatus.in_progress()
    db.session.commit()
    _send_order_scheduled_emails(order, customer, quotation,
                                 reservation=_reservation_of(order_id, quotation.id))
    return jsonify({'confirmed': True}), 200


def _missing_fields_for_quotation(order_id):
    """Campos que le faltan a la orden para que un transportista pueda cotizar.

    Mismos requisitos que los pasos 1 y 2 del flujo del cliente. Se revisan
    también las direcciones, que send_email_to_carrier_companies no mira
    porque en el flujo del cliente el paso 1 ya las exige: una orden armada a
    mano en el backoffice puede llegar acá sin ellas. Los servicios no se
    revisan: siempre tienen valor, marcado o no.
    """
    addresses = AddressesStep(order_id)
    address_values = {**addresses.from_address, **addresses.to_address}
    missing = [
        field for field in addresses.requisites()
        if address_values.get(field) is None or address_values.get(field) == ''
    ]
    details = OrderEntity(order_id).details()
    missing += [field for field in ('appointment_date', 'comments') if not details.get(field)]
    if needs_cargo_weight(details.get('load_type')) and not details.get('cargo_weight_kg'):
        missing.append('cargo_weight_kg')
    return missing

@api.route('/order/<int:order_id>/notify-carriers', methods=['POST'])
def notify_carriers(order_id):
    """Manda la orden a los transportistas a pedido del backoffice.

    Para las órdenes que no salieron solas: las que se crearon a mano con
    datos incompletos y se completaron después desde la edición, que no avisa
    a nadie al guardar. Pasa por send_email_to_carrier_companies, el mismo
    envío (correo + WhatsApp) que dispara el cliente al terminar el flujo.

    Solo llamadas internas: el control de rol se hizo en el backoffice-api.
    """
    if not is_internal_request():
        return jsonify({'message': 'forbidden'}), 403
    order = db.session.get(Order, order_id)
    if order is None:
        return not_found('order not found')

    missing = _missing_fields_for_quotation(order_id)
    if missing:
        return jsonify({'message': 'incomplete', 'missing_fields': missing}), 409
    if order.quotation_requested:
        return jsonify({
            'message': 'already_requested',
            'carrier_notified_at': order.carrier_notified_at.isoformat() + '+00:00'
            if order.carrier_notified_at else None,
        }), 409

    emails_sent = send_email_to_carrier_companies(
        order_id, {'requestQuotationFromCarrierCompany': True}
    )
    db.session.refresh(order)
    return jsonify({
        'emails_sent_by_company_id': emails_sent,
        'carrier_notified_at': order.carrier_notified_at.isoformat() + '+00:00'
        if order.carrier_notified_at else None,
    }), 200

def send_email_to_carrier_companies(order_id, order_data):
    emails_sent = []
    if not order_data.get('requestQuotationFromCarrierCompany'):
        return emails_sent

    belongings_appointment_date_step = BelongingsAppointmentDateStep(order_id)
    is_belongings_appointment_date_step_complete = belongings_appointment_date_step.is_complete()

    db_order = db.session.get(Order, order_id)
    already_requested = db_order and db_order.quotation_requested

    print(f'[Email] order={order_id} already_requested={already_requested} step_complete={is_belongings_appointment_date_step_complete}', flush=True)

    if already_requested:
        return emails_sent

    # Una orden sin cliente no se manda a nadie. El formulario nunca llega acá
    # sin sesión (el paso 3 la exige), pero la ruta es pública y una orden sin
    # dueño se edita sin token: cualquiera podía crear órdenes falsas y hacer
    # que les llegaran a todos los transportistas, sin nadie a quien avisarle
    # las cotizaciones.
    if db_order is None or db_order.customer_id is None:
        print(f'[Email] order={order_id} skipped: no customer', flush=True)
        return emails_sent

    carrier_companies = get_carrier_companies()
    if is_belongings_appointment_date_step_complete:
        for carrier_company in carrier_companies:
            quotation_url = QuotationEntity().generate_quotation_url(
                order_id,
                carrier_company['id'],
                os.getenv('SITE_URL')
            )
            quotation = QuotationEntity().get(order_id, carrier_company['id'])
            print(f'[Email] carrier={carrier_company["id"]} email={carrier_company["email"]} existing_quotation={quotation is not None}', flush=True)
            if quotation is None:
                had_previous_quotation = QuotationsModel.query.filter_by(
                    order_id=order_id,
                    carrier_company_id=carrier_company['id'],
                ).first() is not None

                subject = 'La orden cambió, vuelve a cotizar Chalán' if had_previous_quotation else 'Nueva cotización Chalán'
                send_email(
                    carrier_company['email'],
                    subject,
                    'email/ask_for_quotation',
                    bcc=[],
                    quotation_url=quotation_url,
                )
                print(f'[Email] sent to carrier={carrier_company["id"]}', flush=True)
                template_env_var = 'TWILIO_TEMPLATE_TRANSPORTISTA_CAMBIO' if had_previous_quotation else 'TWILIO_TEMPLATE_TRANSPORTISTA'
                body_label = '[Plantilla: Orden cambió, vuelve a cotizar]' if had_previous_quotation else '[Plantilla: Nueva cotización Chalán]'
                send_whatsapp(
                    carrier_company.get('phone'),
                    os.getenv(template_env_var),
                    {'1': quotation_url},
                    body_label=body_label,
                )
                emails_sent.append(carrier_company['id'])
        if emails_sent and db_order:
            db_order.quotation_requested = True
            db_order.carrier_notified_at = datetime.utcnow()
            db.session.commit()
    return emails_sent

def get_carrier_companies():
    """Empresas a las que se avisa una orden de mudanza: activas, del país y con
    el servicio "mudanza" marcado. Antes bastaba con activa y del país, y una
    empresa que solo embala o solo arma muebles recibía todas las mudanzas.
    """
    carrier_companies = (
        CarrierCompanyModel.query
        .join(CarrierCompanyServiceType,
              CarrierCompanyServiceType.carrier_company_id == CarrierCompanyModel.id)
        .join(ServiceType, ServiceType.id == CarrierCompanyServiceType.service_type_id)
        .filter(
            CarrierCompanyModel.country_id == int(os.getenv('COUNTRY_ID')),
            CarrierCompanyModel.active == 1,
            ServiceType.code == MOVING_SERVICE_CODE,
            ServiceType.active == 1,
        )
        .all()
    )
    return CarrierCompanySchema(many=True).dump(carrier_companies)


# No solo mudanzas: una de cada cuatro órdenes es carga (sacos de arroz,
# ladrillos, geomembrana, un auto), y con "objetos de una mudanza" el modelo
# se negaba ante esas fotos.
RECOGNIZE_ITEMS_PROMPT = (
    'Analiza esta imagen e identifica lo que se va a transportar: muebles, '
    'electrodomésticos, cajas, mercadería, materiales de construcción, maquinaria '
    'o vehículos. '
    'Responde SOLO con una lista, un objeto por línea, con la cantidad al inicio. '
    'Formato: "1 sofá grande", "2 sillas", "50 sacos de cemento", etc. '
    'Si no ves nada que transportar, responde solo NINGUNO. '
    'No incluyas explicaciones ni texto adicional.'
)

# Respuestas que no son objetos. Antes entraban a la lista tal cual y llegaban
# al transportista como un ítem más ("Lo siento, no puedo ayudar con eso.").
_NOT_AN_ITEM = re.compile(
    r"^(ninguno\.?$|lo siento|no puedo|no es posible|no se (ve|ven|observa|identifica)"
    r"|i'?m sorry|sorry|i can'?t|i cannot|unable to)",
    re.IGNORECASE,
)


def recognized_items(text):
    items = []
    for line in (text or '').split('\n'):
        item = line.strip().lstrip('-•*').strip()
        if item and not _NOT_AN_ITEM.match(item):
            items.append(item)
    return items


@api.route('/order/recognize-items', methods=['POST'])
def recognize_items():
    if 'image' not in request.files:
        return jsonify({'message': 'No image provided'}), 400

    order_id = request.form.get('order_id')
    if not order_id:
        return jsonify({'message': 'order_id is required'}), 400

    order = db.session.get(Order, order_id)
    if not order:
        return jsonify({'message': 'Order not found'}), 404

    image_file = request.files['image']

    allowed_types = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}
    if image_file.content_type not in allowed_types:
        return jsonify({'message': 'Invalid image type'}), 400

    max_size = 10 * 1024 * 1024
    image_data = image_file.read()
    if len(image_data) > max_size:
        return jsonify({'message': 'Image too large (max 10MB)'}), 400

    ext = image_file.content_type.split('/')[-1]
    storage_key = f'orders/{order_id}/{uuid.uuid4().hex}.{ext}'

    try:
        storage = get_storage()
        url = storage.upload(image_data, storage_key, image_file.content_type)

        order_image = OrderImage(order_id=order_id, url=url, storage_key=storage_key)
        db.session.add(order_image)
        db.session.commit()
    except Exception as e:
        current_app.logger.error(f'Image upload error: {str(e)}')
        return jsonify({'message': 'Error uploading image'}), 500

    base64_image = base64.b64encode(image_data).decode('utf-8')
    mime_type = image_file.content_type

    try:
        client = OpenAI(api_key=current_app.config['OPENAI_API_KEY'])
        response = client.chat.completions.create(
            model='gpt-4o-mini',
            messages=[
                {
                    'role': 'user',
                    'content': [
                        {
                            'type': 'text',
                            'text': RECOGNIZE_ITEMS_PROMPT,
                        },
                        {
                            'type': 'image_url',
                            'image_url': {
                                'url': f'data:{mime_type};base64,{base64_image}',
                                'detail': 'low',
                            },
                        },
                    ],
                }
            ],
            max_tokens=500,
        )
        message = response.choices[0].message
        items = [] if getattr(message, 'refusal', None) else recognized_items(message.content)
        return jsonify({
            'items': items,
            'image': OrderImageSchema().dump(order_image),
        }), 200
    except Exception as e:
        current_app.logger.error(f'OpenAI Vision error: {str(e)}')
        return jsonify({
            'items': [],
            'image': OrderImageSchema().dump(order_image),
            'message': 'Image saved but could not identify items',
        }), 200


@api.route('/order/<int:order_id>/image/<int:image_id>', methods=['DELETE'])
def delete_order_image(order_id, image_id):
    order_image = OrderImage.query.filter_by(id=image_id, order_id=order_id).first()
    if not order_image:
        return jsonify({'message': 'Image not found'}), 404

    try:
        get_storage().delete(order_image.storage_key)
    except Exception as e:
        current_app.logger.error(f'Image delete error: {str(e)}')
        return jsonify({'message': 'Error deleting image'}), 500

    db.session.delete(order_image)
    db.session.commit()
    return jsonify({'message': 'deleted'}), 200