from datetime import datetime, timedelta, timezone
from ...models import CarrierCompany as CarrierCompanyModel
from ...models import VehicleSchema
from flask import jsonify, current_app
from ... import db
import jwt

class CarrierCompany:

    def __init__(self, id=None):
        self.id = id
        if id:
            carrier_company = db.session.get(CarrierCompanyModel, id)
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
        """Generate a JWT token for carrier company access."""
        payload = {
            'carrier_company_id': carrier_company_id,
            'order_id': order_id,
            'exp': datetime.now(timezone.utc) + timedelta(seconds=expiration),
            'iat': datetime.now(timezone.utc)
        }
        return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')

    @staticmethod
    def verify_carrier_company_token(token):
        """Verify a carrier company JWT token."""
        try:
            data = jwt.decode(
                token,
                current_app.config['SECRET_KEY'],
                algorithms=['HS256']
            )
        except jwt.ExpiredSignatureError:
            return None  # Token expired
        except jwt.InvalidTokenError:
            return None  # Invalid token
        return data

    def generate_orders_url(self, order_id, site_url):
        return site_url +\
            'carrier-company/orders/' +\
            self.generate_carrier_company_token(864000, order_id, self.id)
