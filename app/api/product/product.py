import os
import requests
from flask import jsonify
from ...models import Product as ProductModel
from ...models import Vehicle as VehicleModel

class Product:
    is_active = 1

    def get_active_products(self, filters):
        products = ProductModel.query.\
            filter(ProductModel.active == Product.is_active).\
            filter(ProductModel.from_floor == filters['from_floor']).\
            filter(ProductModel.to_floor == filters['to_floor']).\
            filter(ProductModel.from_neighborhood == filters['from_neighborhood']).\
            filter(ProductModel.to_neighborhood == filters['to_neighborhood']).\
            filter(ProductModel.from_city == filters['from_city']).\
            filter(ProductModel.to_city == filters['to_city']).\
            filter(ProductModel.from_state == filters['from_state']).\
            filter(ProductModel.to_state == filters['to_state']).\
            filter(ProductModel.from_zip_code == filters['from_zip_code']).\
            filter(ProductModel.to_zip_code == filters['to_zip_code']).all()

        output = []
        prod = {}
        for product in products:
            prod = {
                'size': product.vehicle.size,
                'weight': product.vehicle.weight,
                'brand': product.vehicle.brand,
                'model': product.vehicle.model,
                'picture': product.vehicle.picture,
                'price': product.price,
                'description': product.description,
                'id': product.id
            }
            output.append(prod)

        return output

    def generate_products(self, filters):
        params = {
            'origins': '{} {} {} {}'.format(filters['from_neighborhood'], filters['from_zip_code'], filters['from_city'], filters['from_state']),
            'destinations': '{} {} {} {}'.format(filters['to_neighborhood'], filters['to_zip_code'], filters['to_city'], filters['to_state']),
            'mode': 'driving',
            'language': 'es-ES',
            'key': os.environ.get('GOOGLE_CLOUD_API_KEY')
        }

        url = 'https://maps.googleapis.com/maps/api/distancematrix/json'
        r = requests.get(url = url, params = params)
        data = r.json()
        kilometers = data['rows'][0]['elements'][0]['distance']['value']/1000

        vehicles = VehicleModel.query.filter(VehicleModel.active == 1).all()
        
        output = []
        for vehicle in vehicles:
            amount = (kilometers * vehicle.charge_per_kilometer) + ((int(filters['from_floor']) + int(filters['to_floor'])) * vehicle.charge_per_floor)
            output.append({    
                'kms': kilometers,         
                'size': vehicle.size,
                'weight': vehicle.weight,
                'brand': vehicle.brand,
                'model': vehicle.model,
                'picture': vehicle.picture,
                'price': round(amount, 2),
                'description': vehicle.description,
                'id': vehicle.id
            })
        
        return output