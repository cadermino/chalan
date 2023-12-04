from ...models import CarrierCompany as CarrierCompanyModel
from ...models import VehicleSchema

class CarrierCompany:

    def __init__(self, id=None):
        self.id = id
        if id:
            carrier_company = CarrierCompanyModel.query.get(id)
            self.carrier_company = carrier_company

    def get_address(self):
        return self.carrier_company.address

    def get_name(self):
        return self.carrier_company.name

    def get_email(self):
        return self.carrier_company.email

    def get_is_active(self):
        return self.carrier_company.active

    def get_vehicles(self):
        vehicle_schema = VehicleSchema(many=True)
        return vehicle_schema.dump(self.carrier_company.vehicles)

