from datetime import datetime
from flask import current_app, request, url_for, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import TimedJSONWebSignatureSerializer as Serializer
from . import db, ma
from sqlalchemy import func, text

db.metadata.clear()
class Customer(db.Model):
	__tablename__ = 'customers'
	id = db.Column(db.Integer, primary_key=True)
	name = db.Column(db.String(45))
	paternal_last_name = db.Column(db.String(45))
	maternal_last_name = db.Column(db.String(45))
	email = db.Column(db.String(45), unique=True)
	password_hash = db.Column('password', db.String(255))
	mobile_phone = db.Column(db.String(15))
	phone = db.Column(db.String(15))
	created_date = db.Column(db.DateTime(), server_default=func.now())

	@property
	def password(self):
		raise AttributeError('password is not a readable attribute')

	@password.setter
	def password(self, password):
		self.password_hash = generate_password_hash(password)

	def verify_password(self, password):
		return check_password_hash(self.password_hash, password)

	def generate_auth_token(self, expiration):
		s = Serializer(current_app.config['SECRET_KEY'], expires_in=expiration)
		return s.dumps({'id': self.id}).decode('utf-8')

	@staticmethod
	def verify_auth_token(token):
		s = Serializer(current_app.config['SECRET_KEY'])
		try:
			data = s.loads(token)
		except:
			return None
		return Customer.query.get(data['id'])

	def __repr__(self):
		return '<Customer %r>' % self.name

	orders = db.relationship("Order", backref="customers", lazy='dynamic')

class Order(db.Model):
	__tablename__ = 'orders'
	id = db.Column(db.Integer, primary_key=True)
	customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=True)
	country_id = db.Column(db.Integer, db.ForeignKey("lu_country.id"), nullable=True)
	total_kilometers = db.Column(db.Integer, nullable=True)
	order_status_id = db.Column(db.Integer, db.ForeignKey("lu_order_status.id"), server_default=text("'1'"), nullable=False)
	appointment_date = db.Column(db.DateTime(), server_default=func.now())
	comments = db.Column(db.String(500))
	created_date = db.Column(db.DateTime(), server_default=func.now())
	updated_date = db.Column(db.DateTime(), server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'))

	order_details = db.relationship("OrderDetails", backref="orders", lazy='dynamic')
	payments = db.relationship("Payment", backref="orders", lazy='dynamic')
	quotations = db.relationship("Quotations", backref="order", lazy='dynamic')

class OrderDetails(db.Model):
	__tablename__ = 'order_details'
	id = db.Column(db.Integer, primary_key=True)
	type = db.Column(db.Enum('carry_from','deliver_to'), nullable=False)
	floor_number = db.Column(db.Integer, nullable=True)
	order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
	street = db.Column(db.String(45), nullable=True)
	interior_number = db.Column(db.String(45), nullable=True)
	country = db.Column(db.String(20), nullable=True)
	map_url = db.Column(db.String(400), nullable=True)
	neighborhood = db.Column(db.String(45), nullable=True)
	city = db.Column(db.String(45), nullable=True)
	state = db.Column(db.String(45), nullable=True)
	zip_code = db.Column(db.String(45), nullable=True)

class Quotations(db.Model):
	__tablename__ = 'quotations'
	id = db.Column(db.Integer, primary_key=True)
	amount = db.Column(db.Integer, nullable=False)
	order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
	carrier_company_id = db.Column(db.Integer, db.ForeignKey('carrier_company.id'), nullable=True)
	selected = db.Column(db.Boolean, server_default=text('False'))

	carrier_company = db.relationship("CarrierCompany", backref="quotations")

class Vehicle(db.Model):
	__tablename__ = 'vehicles'
	id = db.Column(db.Integer, primary_key=True)
	charge_per_kilometer = db.Column(db.Integer, nullable=False)
	charge_per_floor = db.Column(db.Integer, nullable=False)
	driver_fee = db.Column(db.Integer, nullable=False)
	loader_fee = db.Column(db.Integer, nullable=False)
	loaders_quantity = db.Column(db.Integer, nullable=False)
	size = db.Column(db.Enum('small','medium','large'))
	weight = db.Column(db.String(45))
	width = db.Column(db.String(45))
	height = db.Column(db.String(45))
	length = db.Column(db.String(45))
	brand = db.Column(db.String(45))
	model = db.Column(db.String(45))
	carrier_company_id = db.Column(db.Integer, db.ForeignKey('carrier_company.id'), nullable=False)
	description = db.Column(db.String(200))
	picture = db.Column(db.String(200))
	plates = db.Column(db.String(45))
	base_address = db.Column(db.String(200))
	active = db.Column(db.Integer, server_default=text("'0'"))

class CarrierCompany(db.Model):
	__tablename__ = 'carrier_company'
	id = db.Column(db.Integer, primary_key=True)
	country_id = db.Column(db.Integer, db.ForeignKey("lu_country.id"), nullable=True)
	name = db.Column(db.String(45))
	description = db.Column(db.String(200))
	rfc = db.Column(db.String(12))
	email = db.Column(db.String(45))
	phone = db.Column(db.String(45))
	address = db.Column(db.String(200))
	cover_image = db.Column(db.String(200))
	facebook = db.Column(db.String(200))
	youtube = db.Column(db.String(200))
	active = db.Column(db.Integer)

	vehicles = db.relationship("Vehicle", backref="carrier_company")

class OrderStatus(db.Model):
	__tablename__ = 'lu_order_status'
	id = db.Column(db.Integer, primary_key=True)
	status = db.Column(db.String(45))


class PaymentType(db.Model):
	__tablename__ = 'lu_payment_type'
	id = db.Column(db.Integer, primary_key=True)
	type = db.Column(db.String(45))

	payment = db.relationship("Payment", backref="lu_payment_type")


class Payment(db.Model):
	__tablename__ = 'payments'
	id = db.Column(db.Integer, primary_key=True)
	amount = db.Column(db.Float)
	order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
	lu_payment_type_id = db.Column(db.Integer, db.ForeignKey('lu_payment_type.id'), nullable=False)
	status = db.Column(db.Enum('pending', 'paid', 'cancelled'), nullable=False, server_default=text("'pending'"))
	reference = db.Column(db.String(100), comment='Stripe session id')
	created_date = db.Column(db.DateTime(), server_default=func.now())
	comments = db.Column(db.String(500))
	active = db.Column(db.Integer)


class CalculatedDistance(db.Model):
	__tablename__ = 'calculated_distance'
	id = db.Column(db.Integer, primary_key=True)
	address_origin = db.Column(db.String(200))
	address_destination = db.Column(db.String(200))
	kilometers = db.Column(db.Integer)

class LuCountry(db.Model):
	__tablename__ = 'lu_country'
	id = db.Column(db.Integer, primary_key=True, nullable=False)
	country = db.Column(db.String(40))

class CustomerSchema(ma.ModelSchema):
	class Meta:
		model = Customer


class OrderSchema(ma.ModelSchema):
	class Meta:
		model = Order


class VehicleSchema(ma.ModelSchema):
	class Meta:
		model = Vehicle
		fields = ('brand',
				'model',
				'description',
				'picture',
				'plates',
				'active')


class CarrierCompanySchema(ma.ModelSchema):
	class Meta:
		model = CarrierCompany
