from flask import jsonify
from . import api
from .vehicle import Vehicle as VehicleEntity

@api.route('/vehicle/available', methods=['GET'])
def get_available_vehicles():
    vehicle = VehicleEntity()
    return vehicle.get_first_three_available()