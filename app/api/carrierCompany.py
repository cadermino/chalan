from . import api
from flask import request, jsonify
from .carrier_company import CarrierCompany as CarrierCompanyEntity
from .errors import not_found
from .order.order_status import OrderStatus
from .quotation.quotation_status import QuotationStatus
from .order import Order as OrderEntity
from .decorators import carrier_company_token_required

@api.route('/carrier-company/<int:id>', methods=['GET'])
def carrier_company_data(id):
    carrier_company = CarrierCompanyEntity(id)
    try:
        return jsonify({
            'name': carrier_company.get_name(),
            'address': carrier_company.get_address(),
            'vehicles': carrier_company.get_vehicles(),
            'description': carrier_company.get_description(),
            'phone': carrier_company.get_phone(),
            'cover_image': carrier_company.get_cover_image(),
            'facebook': carrier_company.get_facebook(),
            'youtube': carrier_company.get_youtube(),
        }), 200
    except Exception as e:
        return not_found('Vehicle id not found', e)

@api.route('/carrier-company/orders', methods=['GET'])
@carrier_company_token_required
def orders_by_carrier_company():
    auth_headers = request.headers.get('Authorization', '').split()
    data = CarrierCompanyEntity.verify_carrier_company_token(auth_headers[1])
    carrier_companies = CarrierCompanyEntity.get({'id': data['carrier_company_id']})
    quotations = carrier_companies[0].quotations
    orders = []
    for quotation in quotations:
        orderEntity = OrderEntity(quotation.order_id)
        details = orderEntity.details()
        details['token'] = CarrierCompanyEntity().generate_carrier_company_token(
            864000,
            quotation.order_id,
            data['carrier_company_id']
        )
        if details['lu_order_status'] == OrderStatus.in_progress() \
            and quotation.quotation_status_id == QuotationStatus.Selected():
            orders.append(details)

    return jsonify({
        'orders': orders
    }), 200