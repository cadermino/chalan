from flask import jsonify
from ..models import Sepomex, SepomexSchema
from . import api

@api.route('/address/zipcode/<int:zip_code>', methods=['GET'])
def get_address(zip_code):
    addresses = Sepomex.query.filter_by(cp=zip_code).values('estado', 'municipio', 'cp', 'asentamiento')
    addresses_schema = SepomexSchema(many=True)
    output = addresses_schema.dump(addresses)
    return jsonify(output)