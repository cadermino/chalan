from flask import jsonify, request, g, url_for, current_app
from ..models import Customers
from . import api

@api.route('/posts/')
def get_posts():
    post = Customers.query.filter_by(name='carlos').first()
    return post.to_json()