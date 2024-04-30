import os
from ..quotation.quotation_status import QuotationStatus
from ... import db
from ...models import LuServices as LuServicesModel
from ...models import OrderDetails as OrderDetailsModel
from ...models import Order as OrderModel
from ...models import OrdersServices as OrdersServicesModel
from ...models import Payment as PaymentModel
from ...models import Quotations as QuotationsModel
from ...models import OrderSchema, OrderDetailsSchema, QuotationsSchema, CustomerSchema, PaymentSchema, OrdersServicesSchema

class Order:

    def __init__(self, order_id=None):
        self.order_id = order_id

    def create(self, request):
        order = OrderModel(
            customer_id = request['customer']['customer_id'],
            country_id = os.getenv('COUNTRY_ID')
        )
        db.session.add(order)
        db.session.commit()
        order_details_from = OrderDetailsModel()
        for key in request['orderDetailsOrigin']:
            row = key[5:]
            setattr(order_details_from, row, request['orderDetailsOrigin'][key])
        order_details_from.type = 'carry_from'
        order_details_from.order_id = order.id
        db.session.add(order_details_from)

        order_details_to = OrderDetailsModel()
        for key in request['orderDetailsDestination']:
            row = key[3:]
            setattr(order_details_to, row, request['orderDetailsDestination'][key])
        order_details_to.type = 'deliver_to'
        order_details_to.order_id = order.id
        db.session.add(order_details_to)

        db.session.commit()

        return order

    def details(self):
        order = OrderModel.query.get(self.order_id)

        order_data = OrderSchema().dump(order)
        order_details_data = OrderDetailsSchema(many=True).dump(order.order_details)
        quotations_data = QuotationsSchema(many=True).dump(order.quotations)
        customer_data = CustomerSchema().dump(order.customers)
        payment_data = PaymentSchema(many=True).dump(order.payments)
        services = OrdersServicesSchema(many=True).dump(order.services)
        for service in services:
            name = order.services.filter_by(id = service["id"]).first().service.service
            service["name"] = name

        order_data['order_details'] = order_details_data
        order_data['quotations'] = quotations_data
        order_data['customers'] = customer_data
        order_data['payments'] = payment_data
        order_data['services'] = services
        return order_data

    def update(self, request):
        order = OrderModel.query.get(self.order_id)

        order.customer_id = request['customer']['customer_id']
        order.appointment_date = request['order']['appointment_date']
        order.comments = request['order']['comments']
        order.order_status_id = request['order']['order_status_id']
        order.approximate_budget = request['order']['approximate_budget']
        db.session.add(order)
        db.session.commit()

        order_details_from = order.order_details.filter_by(type = 'carry_from').first()
        for key in request['orderDetailsOrigin']:
            row = key[5:]
            setattr(order_details_from, row, request['orderDetailsOrigin'][key])
        db.session.add(order_details_from)
        db.session.commit()

        order_details_to = order.order_details.filter_by(type = 'deliver_to').first()
        for key in request['orderDetailsDestination']:
            row = key[3:]
            setattr(order_details_to, row, request['orderDetailsDestination'][key])
        db.session.add(order_details_to)
        db.session.commit()

        for service in request['services']:
            service_id = LuServicesModel.query.filter(LuServicesModel.service == service).first().id
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

        return order

    def query_orders(self, data):
        query = OrderModel.query
        for attr,value in data.items():
            query = query.filter(getattr(OrderModel, attr) == value)
        return query.all()

    def create_stripe_payment(self, session_id):
        order = OrderModel.query.get(self.order_id)
        payment = PaymentModel(
            order_id = self.order_id,
            amount = order.product.price,
            lu_payment_type_id = 1,
            status = 'pending',
            reference = session_id,
            active = 1
        )
        db.session.add(payment)
        db.session.commit()

        return payment

    def create_cash_payment(self):
        order = OrderModel.query.get(self.order_id)
        quotation = order.quotations.filter(QuotationsModel.quotation_status_id\
                                            == QuotationStatus.Selected()).first()
        payment = PaymentModel(
            order_id = self.order_id,
            amount = quotation.amount,
            lu_payment_type_id = 2,
            status = 'pending',
            active = 1
        )
        db.session.add(payment)
        db.session.commit()

        return payment

    def confirm_stripe_payment(self, session_id):
        payment = PaymentModel.query.filter_by(order_id = self.order_id).filter_by(reference = session_id).first()
        if payment.reference == session_id:
            payment.status = 'paid'
            db.session.add(payment)
            db.session.commit()

        return payment
