from ...models import CarrierCompany as CarrierCompanyModel
from ...models import VehicleSchema
from flask import jsonify, current_app
from itsdangerous import TimedJSONWebSignatureSerializer as Serializer

class CarrierCompany:

    def __init__(self, id=None):
        self.id = id
        if id:
            carrier_company = CarrierCompanyModel.query.get(id)
            self.carrier_company = carrier_company

    def get_id(self):
        return self.carrier_company.id

    def get_address(self):
        return self.carrier_company.address

    def get_name(self):
        return self.carrier_company.name

    def get_email(self):
        return self.carrier_company.email

    def get_description(self):
        return self.carrier_company.description

    def get_phone(self):
        return self.carrier_company.phone

    def get_cover_image(self):
        return self.carrier_company.cover_image

    def get_facebook(self):
        return self.carrier_company.facebook

    def get_youtube(self):
        return self.carrier_company.youtube

    def get_is_active(self):
        return self.carrier_company.active

    def get_country_id(self):
        return self.carrier_company.active

    def get_vehicles(self):
        vehicle_schema = VehicleSchema(many=True)
        return vehicle_schema.dump(self.carrier_company.vehicles)

    @staticmethod
    def get(data):
        query = CarrierCompanyModel.query
        for attr, value in data.items():
            query = query.filter(getattr(CarrierCompanyModel, attr) == value)
        carrier_companies = query.all()
        return carrier_companies

    def generate_carrier_company_token(self, expiration, order_id, carrier_company_id):
        s = Serializer(current_app.config['SECRET_KEY'], expires_in=expiration)
        return s.dumps({'carrier_company_id': carrier_company_id, 'order_id': order_id}).decode('utf-8')

    @staticmethod
    def verify_carrier_company_token(token):
        s = Serializer(current_app.config['SECRET_KEY'])
        try:
            data = s.loads(token)
        except:
            return None
        return data
