from ..order import Order
from datetime import datetime

class BelongingsAppointmentDate:

    def __init__(self, order_id):
        self.order_id = order_id

    def requisites(self):
        return [
            'appointment_date',
            'comments',
        ]

    def is_complete(self):
        order_details = Order(self.order_id).details()
        is_complete = []
        for requisite in self.requisites():
            req = bool(order_details[requisite])
            if not is_complete:
                is_complete.append(req)
            else:
                is_complete[0] = (is_complete[0] and req)

        return is_complete[0]

    def has_changed(self, data):
        step_data_from_request = {}
        step_data_from_request["appointment_date"] = datetime.strptime(data["appointment_date"], "%Y-%m-%d %H:%M:%S")
        step_data_from_request["comments"] = data["comments"]
        order = Order(self.order_id).details()
        step_data_from_database = {}
        step_data_from_database.update({"appointment_date": datetime.strptime(order.get('appointment_date'), "%Y-%m-%dT%H:%M:%S")})
        step_data_from_database.update({"comments": order.get('comments')})

        return step_data_from_request != step_data_from_database
