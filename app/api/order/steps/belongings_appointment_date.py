from ..order import Order
from datetime import datetime
from ....models import LuServices as LuServicesModel

class BelongingsAppointmentDate:

    def __init__(self, order_id):
        self.order_id = order_id

    def requisites(self):
        return [
            'appointment_date',
            'comments',
            'packaging',
            'cargo',
        ]

    def is_complete(self):
        order_entity = Order(self.order_id)
        requisites_values = order_entity.details()
        service_names = self.__format_order_services(requisites_values["services"])
        requisites_values.update(service_names)
        is_complete = []
        for requisite in self.requisites():
            req = bool(requisites_values[requisite])
            if not is_complete:
                is_complete.append(req)
            else:
                is_complete[0] = (is_complete[0] and req)
        return is_complete[0]

    def has_changed(self, data):
        step_data_from_request = {}
        step_data_from_database = {}
        complete_step_data_from_request = data["order"]
        complete_step_data_from_request.update(data["services"])
        database_order = Order(self.order_id).details()
        services_from_database = self.__format_order_services(database_order["services"])
        complete_step_data_from_database = database_order
        complete_step_data_from_database.update(services_from_database)
        for requisite in self.requisites():
            step_data_from_request[requisite] = complete_step_data_from_request[requisite]
            step_data_from_database[requisite] = complete_step_data_from_database[requisite]
        step_data_from_request["appointment_date"] = datetime.strptime(data["order"]["appointment_date"], "%Y-%m-%d %H:%M:%S")
        raw_date = database_order.get('appointment_date', '')
        for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
            try:
                step_data_from_database["appointment_date"] = datetime.strptime(raw_date, fmt)
                break
            except (ValueError, TypeError):
                continue

        return step_data_from_request != step_data_from_database

    def __format_order_services(self, services):
        lu_services_model = LuServicesModel.query.all()
        services_from_database = {}
        for lu_service in lu_services_model:
            service = list(filter(lambda s: s.get('name') == lu_service.service or s.get('id') == lu_service.id, services))
            services_from_database[lu_service.service] = "1"
            if len(service) == 0:
                services_from_database[lu_service.service] = "0"
        return services_from_database