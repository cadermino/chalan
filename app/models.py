from datetime import datetime
from flask import current_app, request, url_for
from . import db

class Customers(db.Model):
	__tablename__='customers'
	id = db.Column(db.Integer, primary_key=True)
	name = db.Column(db.String(45))
	paternal_last_name = db.Column(db.String(45))
	maternal_last_name = db.Column(db.String(45))
	email = db.Column(db.String(45), unique=True)
	password = db.Column(db.String(128))
	mobile_phone = db.Column(db.String(15))
	phone = db.Column(db.String(15))
	created_date = db.Column(db.DateTime(), default=datetime.utcnow)

	def to_json(self):
		return {
			'username': '{name} {paternal} {maternal}'.format(name=self.name, paternal=self.paternal_last_name, maternal=self.maternal_last_name),
			'member_since': self.created_date,
			'email': self.email,
			'mobile_phone': self.mobile_phone,
		}

	def __repr__(self):
		return '<Customers %r>' % self.name