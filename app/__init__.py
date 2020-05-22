from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_marshmallow import Marshmallow
from config import config
from flask_cors import CORS
import os

db = SQLAlchemy()
ma = Marshmallow()
cors = CORS(origins=os.environ.get('CORS'))

def create_app(config_name):
	app = Flask(__name__)
	app.config.from_object(config[config_name])
	config[config_name].init_app(app)

	db.init_app(app)
	ma.init_app(app)
	cors.init_app(app)

	from .api import api as api_blueprint
	app.register_blueprint(api_blueprint, url_prefix='/api/v1')

	from .auth import auth as auth_blueprint
	app.register_blueprint(auth_blueprint, url_prefix='/api/auth')

	return app