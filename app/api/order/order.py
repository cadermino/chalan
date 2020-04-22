from ... import db
from ...models import OrderDetails, OrderSchema
from ...models import Order as OrderModel

class Order:

    def __init__(self, order_id=None):
        self.order_id = order_id

    def update(self, order_data):
        order = OrderModel.query.get(self.order_id)

        order.customer_id = order_data['customer_id']
        order.order_status_id = order_data['order_status_id']
        order.appointment_date = order_data['appointment_date']
        order.payment_id = order_data['payment_id']
        order.comments = order_data['comments']
        db.session.add(order)
        db.session.commit()

        order_details_from = order.order_details.filter_by(type = 'carry_from').first()
        order_details_to = order.order_details.filter_by(type = 'deliver_to').first()

        order_details_from.floor_number = order_data['from_floor_number']
        order_details_from.street = order_data['from_street']
        order_details_from.interior_number = order_data['from_interior_number']
        order_details_from.neighborhood = order_data['from_neighborhood']
        order_details_from.city = order_data['from_city']
        order_details_from.state = order_data['from_state']
        order_details_from.zip_code = order_data['from_zip_code']
        db.session.add(order_details_from)
        db.session.commit()

        order_details_to.floor_number = order_data['to_floor_number']
        order_details_to.street = order_data['to_street']
        order_details_to.interior_number = order_data['to_interior_number']
        order_details_to.neighborhood = order_data['to_neighborhood']
        order_details_to.city = order_data['to_city']
        order_details_to.state = order_data['to_state']
        order_details_to.zip_code = order_data['to_zip_code']
        db.session.add(order_details_to)
        db.session.commit()
        
        return order

    def create(self, order_data):           
        is_out_of_range = False
        order_data['order_status_id'] = 1
        if order_data['from_state'] != 'Ciudad de México':
            is_out_of_range = True
            order_data['order_status_id'] = 3
        order = OrderModel(
            customer_id = order_data['customer_id'],
            order_status_id = order_data['order_status_id'],
            appointment_date = order_data['appointment_date'],
            comments = order_data['comments']
        )
        db.session.add(order)
        db.session.commit()
        order_details_from = OrderDetails(
            type = 'carry_from',
            floor_number = order_data['from_floor_number'],
            order_id = order.id,
            street = order_data['from_street'],
            interior_number = order_data['from_interior_number'],
            neighborhood = order_data['from_neighborhood'],
            city = order_data['from_city'],
            state = order_data['from_state'],
            zip_code = order_data['from_zip_code'],
        )
        order_details_to = OrderDetails(
            type = 'deliver_to',
            floor_number = order_data['to_floor_number'],
            order_id = order.id,
            street = order_data['to_street'],
            interior_number = order_data['to_interior_number'],
            neighborhood = order_data['to_neighborhood'],
            city = order_data['to_city'],
            state = order_data['to_state'],
            zip_code = order_data['to_zip_code'],
        )
        db.session.add(order_details_from)
        db.session.add(order_details_to)
        db.session.commit()
        
        return (order, is_out_of_range)