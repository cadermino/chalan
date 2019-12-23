from flask import jsonify, request, g, url_for, current_app
from .. import db
from ..models import Customer
from . import api

@api.route('/customers/create', methods=['POST'])
def create_customer():
    return jsonify([1,2,3])