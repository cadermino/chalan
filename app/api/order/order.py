import os
from ..quotation.quotation_status import QuotationStatus
from .load import clean_cargo_weight, clean_load_type, needs_cargo_weight
from ... import db
from ...models import LuServices as LuServicesModel
from ...models import OrderDetails as OrderDetailsModel
from ...models import Order as OrderModel
from ...models import OrdersServices as OrdersServicesModel
from ...models import Payment as PaymentModel
from ...models import PaymentType as PaymentTypeModel
from ...models import Quotations as QuotationsModel
from ...models import AdminUser, ReferredOrder
from ...models import OrderSchema, \
    OrderDetailsSchema,\
    QuotationsSchema,\
    CustomerSchema,\
    PaymentSchema,\
    OrdersServicesSchema,\
    OrderImageSchema,\
    VehicleSchema

_PAYMENT_TYPE_IDS = {}

_COORDINATES = {'latitude': 90, 'longitude': 180}


def _address_value(column, value):
    """Valor de un campo de la dirección tal como se guarda.

    Las coordenadas llegan del navegador y tienen que ser un número dentro de
    rango, o nada: cualquier otra cosa se descarta en vez de reventar el commit
    o dejar basura que ubique la orden en otro lado.
    """
    if column not in _COORDINATES:
        return value
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if abs(number) <= _COORDINATES[column] else None


def _set_load(order, data):
    """Qué lleva la orden y, si es carga, cuánto pesa.

    Solo si el cuerpo trae `load_type`: quien no lo manda (el agente de
    cotizaciones, un cliente con el front viejo en caché) no borra lo que ya
    estaba. Un valor que no es de la lista se guarda vacío, y el peso solo
    queda en una carga. Devuelve los campos que escribió.
    """
    if 'load_type' not in data:
        return []
    order.load_type = clean_load_type(data.get('load_type'))
    order.cargo_weight_kg = (clean_cargo_weight(data.get('cargo_weight_kg'))
                             if needs_cargo_weight(order.load_type) else None)
    return ['load_type', 'cargo_weight_kg']


def yape_reservation_required():
    """True si agendar exige yapear la reserva e informar su nº de operación.

    Es el gemelo de VUE_APP_YAPE_QR_ENABLED del lado del servidor: el modal
    solo pide el número cuando esa variable está activa, y sin este chequeo
    bastaría llamar al endpoint directo para saltarse la reserva.
    """
    return os.getenv('YAPE_RESERVATION_REQUIRED') == 'true'


def payment_type_id(type_name):
    """Resuelve el id de lu_payment_type por nombre.

    Los ids salen de un SERIAL sembrado en db/init.sql, así que hardcodearlos
    (como se hacía con el 2 de 'cash') los ata al orden de inserción. Revienta
    a propósito si el tipo no existe: significa que falta correr la migración
    que lo siembra, y crear el pago con un id inventado rompería la FK.
    """
    if type_name not in _PAYMENT_TYPE_IDS:
        row = PaymentTypeModel.query.filter_by(type=type_name).first()
        if row is None:
            raise ValueError(f'lu_payment_type sin fila "{type_name}"')
        _PAYMENT_TYPE_IDS[type_name] = row.id
    return _PAYMENT_TYPE_IDS[type_name]


class Order:

    def __init__(self, order_id=None):
        self.order_id = order_id
        # Lo que la ultima llamada escribio de verdad. La ruta lo devuelve
        # al cliente para que un PUT que no escribe nada deje de ser
        # indistinguible de uno que si. Se llena junto a cada asignacion,
        # para que no pueda desfasarse de lo que realmente ocurre.
        self.written_fields = []

    def create(self, request):
        order = OrderModel(
            customer_id = request['customer']['customer_id'],
            country_id = os.getenv('COUNTRY_ID')
        )
        _set_load(order, request.get('order') or {})
        db.session.add(order)
        db.session.commit()
        order_details_from = OrderDetailsModel()
        for key in request['orderDetailsOrigin']:
            row = key[5:]
            setattr(order_details_from, row, _address_value(row, request['orderDetailsOrigin'][key]))
        order_details_from.type = 'carry_from'
        order_details_from.order_id = order.id
        db.session.add(order_details_from)

        order_details_to = OrderDetailsModel()
        for key in request['orderDetailsDestination']:
            row = key[3:]
            setattr(order_details_to, row, _address_value(row, request['orderDetailsDestination'][key]))
        order_details_to.type = 'deliver_to'
        order_details_to.order_id = order.id
        db.session.add(order_details_to)

        db.session.commit()

        return order

    def details(self):
        order = db.session.get(OrderModel, self.order_id)

        order_data = OrderSchema().dump(order)
        order_details_data = OrderDetailsSchema(many=True).dump(order.order_details)
        selected_quotation = order.quotations.filter_by(quotation_status_id = QuotationStatus.Selected()).first()
        if selected_quotation is not None:
            quotation_data = QuotationsSchema().dump(selected_quotation)
            # Una empresa puede quedarse sin vehículos; la orden se ve igual.
            vehicles = selected_quotation.carrier_company.vehicles
            vehicle_data = VehicleSchema().dump(vehicles[0]) if vehicles else {}
            order_data['selected_quotation_id'] = quotation_data['id']
            order_data['amount'] = quotation_data['amount']
            order_data['vehicle'] = vehicle_data
        customer_data = CustomerSchema().dump(order.customers)
        payment_data = PaymentSchema(many=True).dump(order.payments)
        services = OrdersServicesSchema(many=True).dump(order.services)
        for service in services:
            # La descripción viaja junto al nombre para que las vistas del
            # transportista puedan rotular servicios que no conocen de
            # antemano: el catálogo tiene cinco y el flujo del cliente solo
            # ofrece dos, así que los demás solo llegan por el backoffice.
            catalog_row = order.services.filter_by(id = service["id"]).first().service
            service["name"] = catalog_row.service
            service["description"] = catalog_row.description

        order_data['order_status_id'] = order.order_status_id
        order_data['order_details'] = order_details_data
        order_data['customers'] = customer_data
        order_data['payments'] = payment_data
        order_data['services'] = services
        order_data['images'] = OrderImageSchema(many=True).dump(order.images)
        return order_data

    def link_customer(self, customer_id):
        """Liga la orden al cliente autenticado, sin tocar nada más.

        Es lo único que necesitan los PUT que no vienen del formulario de la
        mudanza (login, registro, el paso 3 al pedir cotizaciones, el modal de
        pago). Todos ellos reenvían la orden entera tal como quedó guardada en
        el navegador, así que pasarla por update() pisaba con datos viejos lo
        que se hubiera corregido después desde el backoffice: el cliente entra,
        y su copia del navegador gana.
        """
        order = db.session.get(OrderModel, self.order_id)
        self.written_fields = []
        if customer_id is not None and order.customer_id != customer_id:
            order.customer_id = customer_id
            db.session.add(order)
            db.session.commit()
            self.written_fields = ['customer_id']
        return order

    def update(self, request, customer_id=None):
        order = db.session.get(OrderModel, self.order_id)

        # customer_id llega ya validado contra el token por la ruta; el
        # `customer` del cuerpo no se mira, porque cualquiera puede escribir
        # ahí el id que quiera.
        written = []
        if customer_id is not None:
            order.customer_id = customer_id
            written.append('customer_id')
        order.appointment_date = request['order']['appointment_date']
        order.comments = request['order']['comments']
        written.extend(['appointment_date', 'comments'])
        if request['order'].get('order_status_id') is not None:
            order.order_status_id = request['order']['order_status_id']
            written.append('order_status_id')
        # Un campo numerico que el usuario dejo vacio llega como '' desde
        # cualquier formulario, y asignarlo a una columna Integer/Float es un
        # DataError, o sea un 500. Vale lo mismo que ausente: ningun cliente
        # deberia poder tirar la ruta por borrar un numero.
        approximate_budget = request['order']['approximate_budget']
        if approximate_budget is None or approximate_budget == '':
            approximate_budget = 0
        order.approximate_budget = approximate_budget
        loaders_quantity = request['order'].get('loaders_quantity')
        order.loaders_quantity = loaders_quantity if loaders_quantity != '' else None
        written.extend(['approximate_budget', 'loaders_quantity'])
        written.extend(_set_load(order, request['order']))
        db.session.add(order)
        db.session.commit()

        order_details_from = order.order_details.filter_by(type = 'carry_from').first()
        for key in request['orderDetailsOrigin']:
            row = key[5:]
            setattr(order_details_from, row, _address_value(row, request['orderDetailsOrigin'][key]))
        db.session.add(order_details_from)
        db.session.commit()

        order_details_to = order.order_details.filter_by(type = 'deliver_to').first()
        for key in request['orderDetailsDestination']:
            row = key[3:]
            setattr(order_details_to, row, _address_value(row, request['orderDetailsDestination'][key]))
        db.session.add(order_details_to)
        db.session.commit()

        for service in request['services']:
            service_record = LuServicesModel.query.filter(LuServicesModel.service == service).first()
            if service_record is None:
                continue  # Skip unknown services
            service_id = service_record.id
            order_service_model = OrdersServicesModel.query.\
                                filter(OrdersServicesModel.service_id == service_id).\
                                filter(OrdersServicesModel.order_id == self.order_id)
            order_service = order_service_model.first()
            if request['services'][service] == '1' and order_service is None:
                order_service = OrdersServicesModel(order_id = self.order_id, service_id = service_id)
                db.session.add(order_service)
            if request['services'][service] == '0' and order_service is not None:
                order_service_model.delete()
            db.session.commit()

        written.extend(['order_details', 'services'])
        self.written_fields = written
        return order

    def query_orders(self, data):
        query = OrderModel.query
        for attr,value in data.items():
            query = query.filter(getattr(OrderModel, attr) == value)
        return query.all()

    @staticmethod
    def reservation_breakdown(quotation):
        """Cómo se reparte el total cotizado entre la reserva y el efectivo.

        Una sola fórmula para todos los que la necesitan (crear los pagos y
        decidir si el checkout exige la reserva): si se duplicara, un cambio de
        comisión dejaría a una de las dos mirando otro monto.
        """
        platform_fee = float(os.getenv('PLATFORM_FEE'))
        commission_rate = 0
        referred = ReferredOrder.query.filter_by(order_id=quotation.order_id).first()
        if referred:
            agent = db.session.get(AdminUser, referred.admin_user_id)
            commission_rate = agent.commission_rate

        carrier_amount = round(quotation.amount, 2)
        total = round(quotation.amount * (1 + commission_rate + platform_fee), 2)
        return {
            'carrier_amount': carrier_amount,
            'total': total,
            'reservation_amount': round(total - carrier_amount, 2),
        }

    def create_order_payments(self, reference=None):
        """Crea una fila por movimiento de plata de la orden.

        Son dos, con destinatario y momento distintos: la reserva que el
        cliente le yapea a Chalán (su comisión más la del agente si la orden
        viene referida) y el efectivo que le entrega al transportista el día de
        la mudanza. Juntas suman el total cotizado.

        Las dos nacen 'pending'. Yape personal no tiene webhook, así que la
        reserva se confirma a mano desde el backoffice, comparando el número de
        operación que el cliente informó (`reference`) con el yapeo recibido.
        Con YAPE_RESERVATION_REQUIRED el checkout no llega aquí sin ese número;
        sin la variable la reserva sigue siendo optativa y `reference` es None.

        OJO con el histórico: las filas anteriores a la migración 016 quedaron
        marcadas 'order_total' y guardan el bruto de la orden en una sola fila.
        Además arrastran tres eras distintas de `amount` separables solo por
        created_date. Cualquier agregación por movimiento debe filtrar por
        `concept` en vez de sumar la tabla entera.
        """
        order = db.session.get(OrderModel, self.order_id)
        quotation = order.quotations.filter(QuotationsModel.quotation_status_id\
                                            == QuotationStatus.Selected()).first()

        # Ya se agendó con esta cotización: no se duplican filas ni se reenvían
        # correos. Volver desde el dashboard y confirmar otra vez pasa por aquí
        # de nuevo, y el guard del modal no sobrevive al remontaje de la vista.
        # Las filas sin quotation_id son anteriores a la 017 y también cuentan
        # como agendadas.
        existing = PaymentModel.query.filter(
            PaymentModel.order_id == self.order_id,
            PaymentModel.concept == 'carrier_cash',
            PaymentModel.status != 'cancelled',
            db.or_(PaymentModel.quotation_id == quotation.id,
                   PaymentModel.quotation_id.is_(None)),
        ).first()
        if existing:
            # El cliente reintentó, quizá con el número corregido. Solo se toca
            # la reserva que sigue pendiente: una ya confirmada por un admin
            # quedó verificada contra ese número y no se reescribe.
            if reference:
                pending_reservation = PaymentModel.query.filter(
                    PaymentModel.order_id == self.order_id,
                    PaymentModel.concept == 'reservation',
                    PaymentModel.status == 'pending',
                    db.or_(PaymentModel.quotation_id == quotation.id,
                           PaymentModel.quotation_id.is_(None)),
                ).first()
                if pending_reservation is not None:
                    pending_reservation.reference = reference
                    db.session.commit()
            return existing, False

        # Cambió de transportista. Las filas de la cotización anterior dejan de
        # valer: sin cancelarlas la orden quedaría con dos reservas vivas y su
        # suma daría el doble de lo que el cliente debe.
        stale = PaymentModel.query.filter(
            PaymentModel.order_id == self.order_id,
            PaymentModel.quotation_id.isnot(None),
            PaymentModel.quotation_id != quotation.id,
            PaymentModel.status != 'cancelled',
        ).all()
        for previous in stale:
            previous.status = 'cancelled'
            db.session.add(previous)

        breakdown = self.reservation_breakdown(quotation)
        carrier_amount = breakdown['carrier_amount']
        reservation_amount = breakdown['reservation_amount']

        carrier_payment = PaymentModel(
            order_id = self.order_id,
            quotation_id = quotation.id,
            amount = carrier_amount,
            lu_payment_type_id = payment_type_id('cash'),
            concept = 'carrier_cash',
            status = 'pending',
            active = 1
        )
        db.session.add(carrier_payment)

        if reservation_amount > 0:
            db.session.add(PaymentModel(
                order_id = self.order_id,
                quotation_id = quotation.id,
                amount = reservation_amount,
                lu_payment_type_id = payment_type_id('yape'),
                concept = 'reservation',
                status = 'pending',
                reference = reference,
                active = 1
            ))

        db.session.commit()

        # Se devuelve la del transportista porque es la que siempre existe y la
        # que el endpoint venía reportando como "el pago" de la orden. El bool
        # dice si se agendó ahora: el endpoint solo manda correos cuando es
        # cierto, y el modal solo dispara order_confirmed en ese caso.
        return carrier_payment, True
