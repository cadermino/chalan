from flask import jsonify
from ...models import Order as OrderModel
from ...models import Vehicle as VehicleModel

class Vehicle:

    def get_first_three_available(self):
        orders = OrderModel.query.filter(OrderModel.order_status_id.in_(['1','2']))
        unavailable_vehicles = []
        for order in orders:
            driver = order.driver
            vehicle = driver.vehicles
            unavailable_vehicles.append(vehicle.id)

        vehicles = VehicleModel.query.filter(~VehicleModel.id.in_(unavailable_vehicles)).all()

        available = {}
        for vehicle in vehicles:
            try:
                driver = vehicle.driver[0]
                driver_id = driver.id,
                driver_name = '{} {} {}'.format(driver.name, driver.paternal_last_name, driver.maternal_last_name)
            except:
                driver_id = '',
                driver_name = '',

            available[vehicle.size] = {
                'id': vehicle.id,
                'brand': vehicle.brand,
                'model': vehicle.model,
                'size': vehicle.size,
                'driver_id': driver_id[0],
                'driver_name': driver_name,
            }

        return jsonify(available)