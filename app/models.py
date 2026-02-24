from datetime import datetime, timedelta, timezone
from flask import current_app
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from . import db, ma
from sqlalchemy import func, text

db.metadata.clear()
class CalculatedDistance(db.Model):
	__tablename__ = 'calculated_distance'
	id = db.Column(db.Integer, primary_key=True)
	address_origin = db.Column(db.String(200))
	address_destination = db.Column(db.String(200))
	kilometers = db.Column(db.Integer)

class CarrierCompany(db.Model):
	__tablename__ = 'carrier_company'
	id = db.Column(db.Integer, primary_key=True)
	country_id = db.Column(db.Integer, db.ForeignKey("lu_country.id"), nullable=True)
	name = db.Column(db.String(45))
	description = db.Column(db.String(2000))
	rfc = db.Column(db.String(12))
	email = db.Column(db.String(45))
	phone = db.Column(db.String(45))
	address = db.Column(db.String(200))
	cover_image = db.Column(db.String(200))
	facebook = db.Column(db.String(200))
	youtube = db.Column(db.String(200))
	active = db.Column(db.Integer)

	vehicles = db.relationship("Vehicle", backref="carrier_company")
	country = db.relationship("LuCountry", backref="carrier_company")

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
		"""Generate a JWT token with expiration."""
		payload = {
			'id': self.id,
			'exp': datetime.now(timezone.utc) + timedelta(seconds=expiration),
			'iat': datetime.now(timezone.utc)
		}
		return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')

	@staticmethod
	def verify_auth_token(token):
		"""Verify a JWT token and return the customer if valid."""
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
		return db.session.get(Customer, data['id'])

	def __repr__(self):
		return '<Customer %r>' % self.name

	orders = db.relationship("Order", backref="customers", lazy='dynamic')

class LuCountry(db.Model):
	__tablename__ = 'lu_country'
	id = db.Column(db.Integer, primary_key=True, nullable=False)
	country = db.Column(db.String(40), nullable=False)

class LuQuotationStatus(db.Model):
	__tablename__ = 'lu_quotation_status'
	id = db.Column(db.Integer, primary_key=True)
	status = db.Column(db.String(45))

class LuServices(db.Model):
	__tablename__ = 'lu_services'
	id = db.Column(db.Integer, primary_key=True)
	service = db.Column(db.String(50))
	description = db.Column(db.String(200))

class Order(db.Model):
	__tablename__ = 'orders'
	id = db.Column(db.Integer, primary_key=True)
	customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=True)
	country_id = db.Column(db.Integer, db.ForeignKey("lu_country.id"), nullable=True)
	total_kilometers = db.Column(db.Integer, nullable=True)
	order_status_id = db.Column(db.Integer, db.ForeignKey("lu_order_status.id"), server_default='1', nullable=False)
	appointment_date = db.Column(db.DateTime(), server_default=func.now())
	comments = db.Column(db.String(500))
	total_amount = db.Column(db.Float, nullable=True)
	approximate_budget = db.Column(db.Float, nullable=True)
	created_date = db.Column(db.DateTime(), server_default=func.now())
	updated_date = db.Column(db.DateTime(), server_default=func.now(), onupdate=func.now())

	order_details = db.relationship("OrderDetails", backref="orders", lazy='dynamic')
	payments = db.relationship("Payment", backref="orders", lazy='dynamic')
	quotations = db.relationship("Quotations", backref="order", lazy='dynamic')
	services = db.relationship("OrdersServices", backref="order", lazy='dynamic')

class OrderDetails(db.Model):
	__tablename__ = 'order_details'
	id = db.Column(db.Integer, primary_key=True)
	type = db.Column(db.Enum('carry_from','deliver_to', name='order_detail_type'), nullable=False)
	floor_number = db.Column(db.Integer, nullable=True)
	order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
	street = db.Column(db.String(200), nullable=True)
	interior_number = db.Column(db.String(45), nullable=True)
	country = db.Column(db.String(20), nullable=True)
	map_url = db.Column(db.String(400), nullable=True)
	neighborhood = db.Column(db.String(45), nullable=True)
	city = db.Column(db.String(45), nullable=True)
	state = db.Column(db.String(45), nullable=True)
	zip_code = db.Column(db.String(45), nullable=True)
	has_elevator = db.Column(db.Integer, server_default='0')
	approximate_distance_from_parking = db.Column(db.Integer, nullable=True)

class OrdersServices(db.Model):
	__tablename__ = 'orders_services'
	id = db.Column(db.Integer, primary_key=True)
	order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
	service_id = db.Column(db.Integer, db.ForeignKey('lu_services.id'), nullable=False)

	service = db.relationship("LuServices", backref="services")

class OrderStatus(db.Model):
	__tablename__ = 'lu_order_status'
	id = db.Column(db.Integer, primary_key=True)
	status = db.Column(db.String(45))

	order = db.relationship("Order", backref="lu_order_status")

class Payment(db.Model):
	__tablename__ = 'payments'
	id = db.Column(db.Integer, primary_key=True)
	amount = db.Column(db.Float)
	order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
	lu_payment_type_id = db.Column(db.Integer, db.ForeignKey('lu_payment_type.id'), nullable=False)
	status = db.Column(db.Enum('pending', 'paid', 'cancelled', name='payment_status'), nullable=False, server_default='pending')
	reference = db.Column(db.String(100), comment='Stripe session id')
	created_date = db.Column(db.DateTime(), server_default=func.now())
	comments = db.Column(db.String(500))
	active = db.Column(db.Integer)

class PaymentType(db.Model):
	__tablename__ = 'lu_payment_type'
	id = db.Column(db.Integer, primary_key=True)
	type = db.Column(db.String(45))

	payment = db.relationship("Payment", backref="lu_payment_type")

class Quotations(db.Model):
	__tablename__ = 'quotations'
	id = db.Column(db.Integer, primary_key=True)
	amount = db.Column(db.Integer, nullable=False)
	order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
	carrier_company_id = db.Column(db.Integer, db.ForeignKey('carrier_company.id'), nullable=True)
	selected = db.Column(db.SmallInteger, server_default='0')
	quotation_status_id = db.Column(db.Integer, db.ForeignKey("lu_quotation_status.id"), server_default='1', nullable=False)
	created_date = db.Column(db.DateTime(), server_default=func.now())
	updated_date = db.Column(db.DateTime(), server_default=func.now(), onupdate=func.now())

	carrier_company = db.relationship("CarrierCompany", backref="quotations")

class Vehicle(db.Model):
	__tablename__ = 'vehicles'
	id = db.Column(db.Integer, primary_key=True)
	charge_per_kilometer = db.Column(db.Integer, nullable=False)
	charge_per_floor = db.Column(db.Integer, nullable=False)
	driver_fee = db.Column(db.Integer, nullable=False)
	loader_fee = db.Column(db.Integer, nullable=False)
	loaders_quantity = db.Column(db.Integer, nullable=False)
	size = db.Column(db.Enum('small','medium','large', name='vehicle_size'))
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
	active = db.Column(db.Integer, server_default='0')

class Review(db.Model):
	__tablename__ = 'reviews'
	id = db.Column(db.Integer, primary_key=True)
	order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
	customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
	carrier_company_id = db.Column(db.Integer, db.ForeignKey('carrier_company.id'), nullable=False)
	rating = db.Column(db.Integer, nullable=False)
	comment = db.Column(db.String(1000))
	created_date = db.Column(db.DateTime(), server_default=func.now())

	order = db.relationship("Order", backref="reviews")
	customer = db.relationship("Customer", backref="reviews")
	carrier_company = db.relationship("CarrierCompany", backref="reviews")


class CustomerSchema(ma.SQLAlchemyAutoSchema):
	class Meta:
		model = Customer
		load_instance = True
		fields = (
			'id',
			'name',
			'paternal_last_name',
			'maternal_last_name',
			'email',
			'mobile_phone',
			'phone',
			'created_date',
		)

class CarrierCompanySchema(ma.SQLAlchemyAutoSchema):
	class Meta:
		model = CarrierCompany
		load_instance = True

class OrderSchema(ma.SQLAlchemyAutoSchema):
	class Meta:
		model = Order
		load_instance = True

class OrderDetailsSchema(ma.SQLAlchemyAutoSchema):
	class Meta:
		model = OrderDetails
		load_instance = True

class OrdersServicesSchema(ma.SQLAlchemyAutoSchema):
	class Meta:
		model = OrdersServices
		load_instance = True

class PaymentSchema(ma.SQLAlchemyAutoSchema):
	class Meta:
		model = Payment
		load_instance = True

class QuotationsSchema(ma.SQLAlchemyAutoSchema):
	class Meta:
		model = Quotations
		load_instance = True
		fields = ('id',
				'amount',
				'order_id',
				'carrier_company_id',
				'quotation_status_id')

class VehicleSchema(ma.SQLAlchemyAutoSchema):
	class Meta:
		model = Vehicle
		load_instance = True
		fields = ('brand',
				'model',
				'description',
				'picture',
				'plates',
				'active')

class ReviewSchema(ma.SQLAlchemyAutoSchema):
	class Meta:
		model = Review
		load_instance = True
		fields = ('id', 'order_id', 'customer_id', 'carrier_company_id',
				'rating', 'comment', 'created_date')
