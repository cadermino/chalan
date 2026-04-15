from datetime import datetime, timedelta, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from flask import current_app
from sqlalchemy import func
import jwt

from . import db

# Roles
ROLE_SUPERADMIN = 'superadmin'
ROLE_ADMIN = 'admin'
ROLE_CARRIER = 'carrier_company'
ALL_ROLES = (ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_CARRIER)


class AdminUser(db.Model):
    __tablename__ = 'admin_users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column('password', db.String(255), nullable=False)
    first_name = db.Column(db.String(80), nullable=True)
    last_name = db.Column(db.String(80), nullable=True)
    dni = db.Column(db.String(20), nullable=True)
    role = db.Column(db.String(20), nullable=False, server_default=ROLE_ADMIN)
    carrier_company_id = db.Column(db.Integer, nullable=True)
    active = db.Column(db.Integer, server_default='1')
    created_date = db.Column(db.DateTime(), server_default=func.now())

    @property
    def password(self):
        raise AttributeError('password is not readable')

    @password.setter
    def password(self, password):
        self.password_hash = generate_password_hash(password)

    def verify_password(self, password):
        return check_password_hash(self.password_hash, password)

    def generate_auth_token(self, expiration=86400):
        payload = {
            'id': self.id,
            'role': self.role,
            'carrier_company_id': self.carrier_company_id,
            'exp': datetime.now(timezone.utc) + timedelta(seconds=expiration),
        }
        return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')

    @staticmethod
    def verify_auth_token(token):
        try:
            data = jwt.decode(
                token,
                current_app.config['SECRET_KEY'],
                algorithms=['HS256'],
            )
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            return None
        return db.session.get(AdminUser, data['id'])

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'dni': self.dni,
            'role': self.role,
            'carrier_company_id': self.carrier_company_id,
            'active': bool(self.active),
            'created_date': self.created_date.isoformat() if self.created_date else None,
        }


# Mirror models — these tables already exist; we only read/write, never create.

class CarrierCompany(db.Model):
    __tablename__ = 'carrier_company'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    country_id = db.Column(db.Integer, nullable=True)
    name = db.Column(db.String(45))
    description = db.Column(db.String(2000))
    rfc = db.Column(db.String(12))
    email = db.Column(db.String(45))
    phone = db.Column(db.String(45))
    address = db.Column(db.String(200))
    cover_image = db.Column(db.String(200))
    facebook = db.Column(db.String(200))
    youtube = db.Column(db.String(200))
    active = db.Column(db.Integer, server_default='1')

    vehicles = db.relationship('Vehicle', backref='carrier_company', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'rfc': self.rfc,
            'email': self.email,
            'phone': self.phone,
            'address': self.address,
            'cover_image': self.cover_image,
            'facebook': self.facebook,
            'youtube': self.youtube,
            'active': bool(self.active),
            'country_id': self.country_id,
        }


class Vehicle(db.Model):
    __tablename__ = 'vehicles'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    carrier_company_id = db.Column(db.Integer, db.ForeignKey('carrier_company.id'), nullable=False)
    brand = db.Column(db.String(45))
    model = db.Column(db.String(45))
    plates = db.Column(db.String(45))
    size = db.Column(db.String(10))       # small | medium | large
    description = db.Column(db.String(400))
    width = db.Column(db.String(45))
    height = db.Column(db.String(45))
    length = db.Column(db.String(45))
    base_address = db.Column(db.String(200))
    charge_per_kilometer = db.Column(db.Integer, nullable=False, server_default='0')
    charge_per_floor = db.Column(db.Integer, nullable=False, server_default='0')
    driver_fee = db.Column(db.Integer, nullable=False, server_default='0')
    loader_fee = db.Column(db.Integer, nullable=False, server_default='0')
    loaders_quantity = db.Column(db.Integer, nullable=False, server_default='0')
    active = db.Column(db.Integer, server_default='0')

    def to_dict(self):
        return {
            'id': self.id,
            'carrier_company_id': self.carrier_company_id,
            'brand': self.brand,
            'model': self.model,
            'plates': self.plates,
            'size': self.size,
            'description': self.description,
            'picture': self.picture,
            'weight': self.weight,
            'width': self.width,
            'height': self.height,
            'length': self.length,
            'base_address': self.base_address,
            'charge_per_kilometer': self.charge_per_kilometer,
            'charge_per_floor': self.charge_per_floor,
            'driver_fee': self.driver_fee,
            'loader_fee': self.loader_fee,
            'loaders_quantity': self.loaders_quantity,
            'active': bool(self.active),
        }
