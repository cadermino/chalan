from datetime import datetime
from flask import current_app, request, url_for, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import TimedJSONWebSignatureSerializer as Serializer
from . import db, ma
from .api.errors import bad_request

# db.metadata.clear()
class Customer(db.Model):
	__tablename__ = 'customers'
	id = db.Column(db.Integer, primary_key=True)
	name = db.Column(db.String(45))
	paternal_last_name = db.Column(db.String(45))
	maternal_last_name = db.Column(db.String(45))
	email = db.Column(db.String(45), unique=True)
	password_hash = db.Column('password', db.String(128))
	mobile_phone = db.Column(db.String(15))
	phone = db.Column(db.String(15))
	created_date = db.Column(db.DateTime(), default=datetime.utcnow)

	orders = db.relationship("Order", backref="customer")

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


class Order(db.Model):
	__tablename__ = 'orders'
	id = db.Column(db.Integer, primary_key=True)
	customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=True)
	driver_id = db.Column(db.Integer, db.ForeignKey("drivers.id"), nullable=True)
	order_status_id = db.Column(db.Integer, db.ForeignKey("lu_order_status.id"), default='1', nullable=False)
	appointment_date = db.Column(db.DateTime(), default=datetime.now)
	payment_id = db.Column(db.Integer, db.ForeignKey("payments.id"), nullable=True)
	comments = db.Column(db.String(500))

	order_details = db.relationship("OrderDetails", backref="orders", lazy='dynamic')

class OrderDetails(db.Model):
	__tablename__ = 'order_details'
	id = db.Column(db.Integer, primary_key=True)
	type = db.Column(db.Enum('carry_from','deliver_to'), nullable=False)
	floor_number = db.Column(db.Integer, nullable=True)
	order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
	street = db.Column(db.String(45), nullable=True)
	interior_number = db.Column(db.String(45), nullable=True)
	neighborhood = db.Column(db.String(45), nullable=True)
	city = db.Column(db.String(45), nullable=True)
	state = db.Column(db.String(45), nullable=True)
	zip_code = db.Column(db.String(45), nullable=True)


class Driver(db.Model):
	__tablename__ = 'drivers'
	id = db.Column(db.Integer, primary_key=True)
	name = db.Column(db.String(45))
	paternal_last_name = db.Column(db.String(45))
	maternal_last_name = db.Column(db.String(45))
	mobile_phone = db.Column(db.String(15))
	vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicles.id'), nullable=False)
	carrier_company_id = db.Column(db.Integer, db.ForeignKey('carrier_company.id'), nullable=True)
	created_date = db.Column(db.DateTime(), default=datetime.utcnow)

	orders = db.relationship("Order", backref="driver")

class CarrierCompany(db.Model):
	__tablename__ = 'carrier_company'
	id = db.Column(db.Integer, primary_key=True)
	name = db.Column(db.String(45))

	drivers = db.relationship('Driver', backref='carrier_company')

class OrderStatus(db.Model):
	__tablename__ = 'lu_order_status'
	id = db.Column(db.Integer, primary_key=True)
	status = db.Column(db.String(45))


class PaymentType(db.Model):
	__tablename__ = 'lu_payment_type'
	id = db.Column(db.Integer, primary_key=True)
	type = db.Column(db.String)

	payment = db.relationship("Payment", backref="payment_type")


class Payment(db.Model):
	__tablename__ = 'payments'
	id = db.Column(db.Integer, primary_key=True)
	amount = db.Column(db.Float)
	lu_payment_type_id = db.Column(db.Integer, db.ForeignKey('lu_payment_type.id'), nullable=False)
	reference = db.Column(db.String(45))
	created_date = db.Column(db.DateTime(), default=datetime.utcnow)
	comments = db.Column(db.String(500))

	orders = db.relationship("Order", backref="payments")

class Vehicle(db.Model):
	__tablename__ = 'vehicles'
	id = db.Column(db.Integer, primary_key=True)
	size = db.Column(db.Enum('small','medium','large'))
	plate = db.Column(db.String(45))
	model = db.Column(db.String(45))
	brand = db.Column(db.String(45))

	driver = db.relationship("Driver", backref="vehicles")


class CustomerSchema(ma.ModelSchema):
	class Meta:
		model = Customer


class OrderSchema(ma.ModelSchema):
	class Meta:
		model = Order