import os
import requests
from flask import jsonify
from ...models import Product as ProductModel
from ...models import Vehicle as VehicleModel
from ...models import Order as OrderModel
from ...models import CalculatedDistance as CalculatedDistanceModel
from ... import db

class Product:
    is_active = 1

    def create(self, data):
        if data['product_id'] is not None:
            product = ProductModel.query.get(data['product_id'])
            product.vehicle_id = data['vehicle_id']
            product.price = data['price']
            product.active = data['active']

        else:
            product = ProductModel(
                vehicle_id = data['vehicle_id'],
                price = data['price'],
                active = data['active']
            )
        db.session.add(product)
        db.session.commit()
        
        return product

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

    def generate_products(self, filters, order_id):
        order = OrderModel.query.get(order_id)

        origins = '{} {} {} {}'.format(filters['from_neighborhood'], filters['from_zip_code'], filters['from_city'], filters['from_state'])
        destinations = '{} {} {} {}'.format(filters['to_neighborhood'], filters['to_zip_code'], filters['to_city'], filters['to_state'])
        calculated_distance = CalculatedDistanceModel.query.filter_by(address_origin = origins).filter_by(address_destination = destinations).first()

        if calculated_distance is None:
            params = {
                'origins': origins,
                'destinations': destinations,
                'mode': 'driving',
                'language': 'es-ES',
                'key': os.environ.get('GOOGLE_CLOUD_API_KEY')
            }
            url = 'https://maps.googleapis.com/maps/api/distancematrix/json'
            r = requests.get(url = url, params = params)
            data = r.json()
            kilometers = data['rows'][0]['elements'][0]['distance']['value']/1000
            order.total_kilometers = kilometers
            db.session.add(order)
            db.session.commit()
            calculated_distance = CalculatedDistanceModel(
                address_origin = origins,
                address_destination = destinations,
                kilometers = kilometers
            )
            db.session.add(calculated_distance)
            db.session.commit()

        vehicles = VehicleModel.query.filter(VehicleModel.active == 1).all()
        
        output = []
        for vehicle in vehicles:
            amount = (calculated_distance.kilometers * vehicle.charge_per_kilometer) + ((int(filters['from_floor']) + int(filters['to_floor'])) * vehicle.charge_per_floor)
            output.append({    
                'kms': calculated_distance.kilometers,         
                'size': vehicle.size,
                'weight': vehicle.weight,
                'brand': vehicle.brand,
                'model': vehicle.model,
                'picture': vehicle.picture,
                'price': round(amount, 2),
                'description': vehicle.description,
                'vehicle_id': vehicle.id
            })
        
        return output