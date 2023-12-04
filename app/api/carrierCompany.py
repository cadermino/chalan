from . import api
from flask import jsonify
from .carrier_company import CarrierCompany as CarrierCompanyEntity
from .errors import not_found

@api.route('/carrier-company/<int:id>', methods=['GET'])
def carrier_company_data(id):
    carrier_company = CarrierCompanyEntity(id)
    try:
        return jsonify({
            'name': carrier_company.get_name(),
            'address': carrier_company.get_address(),
            'vehicles': carrier_company.get_vehicles(),
            'description': '',
            'country': ''
        }), 200
    except Exception as e:
        return not_found('Vehicle id not found', e)
