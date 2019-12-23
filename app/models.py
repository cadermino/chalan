from datetime import datetime
from flask import current_app, request, url_for, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import TimedJSONWebSignatureSerializer as Serializer
from . import db
from .api.errors import bad_request

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
		
	def to_json(self):
		return {
			'username': '{name} {paternal} {maternal}'.format(name=self.name, paternal=self.paternal_last_name, maternal=self.maternal_last_name),
			'member_since': self.created_date,
			'email': self.email,
			'mobile_phone': self.mobile_phone,
		}

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
	customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=False)
	driver_id = db.Column(db.Integer, db.ForeignKey("drivers.id"), nullable=False)
	order_status_id = db.Column(db.Integer, db.ForeignKey("lu_order_status.id"), default='1', nullable=False)
	appointment_date = db.Column(db.DateTime(), default=datetime.utcnow)
	carry_from = db.Column(db.Integer, db.ForeignKey("addresses.id"), nullable=False)
	deliver_to = db.Column(db.Integer, db.ForeignKey("addresses.id"), nullable=False)
	floor_number = db.Column(db.Integer)
	payment_id = db.Column(db.Integer, db.ForeignKey("payment.id"), nullable=True)
	comments = db.Column(db.String(500))

	def __repr__(self):
		return '<Order %r>' % self.id

class Address(db.Model):
	__tablename__ = 'addresses'
	id = db.Column(db.Integer, primary_key=True)
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

class Carrier_company(db.Model):
	__tablename__ = 'carrier_company'
	id = db.Column(db.Integer, primary=True)
	name = db.Column(db.String(45))

	drivers = db.relationship('Driver', backref='carrier_company')

class Order_status(db.Model):
	__tablename__ = 'lu_order_status'
	id = db.Column(db.Integer, primary_key=True)
	status = db.Column(db.String(45))


class Payment_type(db.Model):
	__tablename__ = 'lu_payment_type'
	id = db.Column(db.Integer, primery_key=True)
	type = db.Column(db.String)


class Payment(db.Model):
	__tablename__ = 'payments'
	id = db.Column(db.Integer, primary_key=True)
	amount = db.Column(db.Float)
	lu_payment_type_id = db.Column(db.Integer, db.ForeignKey('lu_payment_type.id'), nullable=False)
	reference = db.Column(db.String(45))
	created_date = db.Column(db.DateTime(), default=datetime.utcnow)
	comments = db.Column(db.String(500))

	orders = db.relationship("Order", backref="payment")

class Vehicle(db.Model):
	__tablename__ = 'vehicles'
	id = db.Column(db.Integer, primary_key=True)
	size = db.Column(db.Enum('small','medium','large'))
	plate = db.Column(db.String(45))
	model = db.Column(db.String(45))
	brand = db.Column(db.String(45))

	driver = db.relationship("Driver", backref="vehicles")