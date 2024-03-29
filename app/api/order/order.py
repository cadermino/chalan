import os
from ..quotation.quotation_status import QuotationStatus
from ... import db
from ...models import OrderDetails
from ...models import Order as OrderModel
from ...models import Payment as PaymentModel
from ...models import Quotations as QuotationsModel
from ...models import OrderSchema, OrderDetailsSchema, QuotationsSchema, CustomerSchema, PaymentSchema

class Order:

    def __init__(self, order_id=None):
        self.order_id = order_id

    def create(self, order_data):
        order = OrderModel(
            customer_id = order_data['customer']['customer_id'],
            country_id = os.getenv('COUNTRY_ID')
        )
        db.session.add(order)
        db.session.commit()
        order_details_from = OrderDetails(
            type = 'carry_from',
            floor_number = order_data['order']['from_floor_number'],
            order_id = order.id,
            street = order_data['order']['from_street'],
            interior_number = order_data['order']['from_interior_number'],
            zip_code = order_data['order']['from_zip_code'],
            country = order_data['order']['from_country'],
            map_url = order_data['order']['from_map_url']
        )
        order_details_to = OrderDetails(
            type = 'deliver_to',
            floor_number = order_data['order']['to_floor_number'],
            order_id = order.id,
            street = order_data['order']['to_street'],
            interior_number = order_data['order']['to_interior_number'],
            zip_code = order_data['order']['to_zip_code'],
            country = order_data['order']['to_country'],
            map_url = order_data['order']['to_map_url']
        )
        db.session.add(order_details_from)
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

        order_data['order_details'] = order_details_data
        order_data['quotations'] = quotations_data
        order_data['customers'] = customer_data
        order_data['payments'] = payment_data
        return order_data

    def update(self, order_data):
        order = OrderModel.query.get(self.order_id)

        order.customer_id = order_data['customer']['customer_id']
        order.appointment_date = order_data['order']['appointment_date']
        order.comments = order_data['order']['comments']
        order.order_status_id = order_data['order']['order_status_id']
        db.session.add(order)
        db.session.commit()

        order_details_from = order.order_details.filter_by(type = 'carry_from').first()
        order_details_to = order.order_details.filter_by(type = 'deliver_to').first()

        order_details_from.floor_number = order_data['order']['from_floor_number']
        order_details_from.street = order_data['order']['from_street']
        order_details_from.interior_number = order_data['order']['from_interior_number']
        order_details_from.zip_code = order_data['order']['from_zip_code']
        order_details_from.country = order_data['order']['from_country']
        order_details_from.map_url = order_data['order']['from_map_url']
        db.session.add(order_details_from)
        db.session.commit()

        order_details_to.floor_number = order_data['order']['to_floor_number']
        order_details_to.street = order_data['order']['to_street']
        order_details_to.interior_number = order_data['order']['to_interior_number']
        order_details_to.zip_code = order_data['order']['to_zip_code']
        order_details_to.country = order_data['order']['to_country']
        order_details_to.map_url = order_data['order']['to_map_url']
        db.session.add(order_details_to)
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
