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
        vehicles = VehicleModel.query.filter(VehicleModel.active == 1).all()
        
        customer_origin_address = '{} {} {} {}'.format(filters['from_neighborhood'], filters['from_zip_code'], filters['from_city'], filters['from_state'])
        customer_destination_address = '{} {} {} {}'.format(filters['to_neighborhood'], filters['to_zip_code'], filters['to_city'], filters['to_state'])
        
        origin_to_destination_distance = CalculatedDistanceModel.query.filter_by(address_origin = customer_origin_address).filter_by(address_destination = customer_destination_address).first().kilometers
        destination_to_base_distance = CalculatedDistanceModel.query.filter_by(address_origin = customer_destination_address).filter_by(address_destination = vehicle_base_address).first().kilometers

        output = []
        for vehicle in vehicles:

            vehicle_base_address = vehicle.base_address
            
            origins = '{}|{}|{}'.format(vehicle_base_address, customer_origin_address, customer_destination_address)
            destinations = '{}|{}|{}'.format(customer_origin_address, customer_destination_address, vehicle_base_address)
            
            base_to_origin_distance = CalculatedDistanceModel.query.filter_by(address_origin = vehicle_base_address).filter_by(address_destination = customer_origin_address).first().kilometers
            
            print(base_to_origin_distance)
            print(origin_to_destination_distance)
            print(destination_to_base_distance)
            
            if None in [base_to_origin_distance, origin_to_destination_distance, destination_to_base_distance]:
                params = {
                    'origins': origins,
                    'destinations': destinations,
                    'mode': 'driving',
                    'language': 'es-ES',
                    'key': os.environ.get('GOOGLE_CLOUD_API_KEY')
                }
                url = os.environ.get('GOOGLE_DISTANCE_MATRIX_URL')
                r = requests.get(url = url, params = params)
                data = r.json()
                # print(data)
                base_to_origin_distance = data['rows'][0]['elements'][0]['distance']['value']/1000
                origin_to_destination_distance = data['rows'][1]['elements'][1]['distance']['value']/1000
                destination_to_base_distance = data['rows'][2]['elements'][2]['distance']['value']/1000
                total_kilometers = base_to_origin_distance + origin_to_destination_distance + destination_to_base_distance
                # kilometers = data['rows'][0]['elements'][0]['distance']['value']/1000
                order.total_kilometers = total_kilometers
                db.session.add(order)
                db.session.commit()

                vehicle_base_to_customer_origin_distance = self.__persist_distances(vehicle_base_address, customer_origin_address, base_to_origin_distance)
                customer_origin_to_customer_destination_distance = self.__persist_distances(vehicle_base_address, customer_origin_address, base_to_origin_distance)
                customer_destination_to_vehicle_base_distance = self.__persist_distances(vehicle_base_address, customer_origin_address, base_to_origin_distance)
                    
                    if expression:
                        calculated_distance = CalculatedDistanceModel(
                            address_origin = vehicle_base_address,
                            address_destination = customer_origin_address,
                            kilometers = base_to_origin_distance
                        )
                        db.session.add(calculated_distance)
                        db.session.commit()

            # else:
                # total_kilometers = base_to_origin_distance + origin_to_destination_distance + destination_to_base_distance

            # raw_amount = (total_kilometers * vehicle.charge_per_kilometer) + ((int(filters['from_floor']) + int(filters['to_floor'])) * vehicle.charge_per_floor)
            # chalan_fee = raw_amount * 0.1
            # amount = raw_amount + chalan_fee
            # output.append({    
            #     'kms': total_kilometers,         
            #     'size': vehicle.size,
            #     'weight': vehicle.weight,
            #     'brand': vehicle.brand,
            #     'model': vehicle.model,
            #     'picture': vehicle.picture,
            #     'price': round(amount, 2),
            #     'description': vehicle.description,
            #     'vehicle_id': vehicle.id
            # })
        
        return data

    def __persist_distances(self, origin, destination, kilometers):
        data_model = CalculatedDistanceModel(
            address_origin = origin,
            address_destination = destination,
            kilometers = kilometers
        )
        return data_model
        vehicle_base_to_customer_origin_distance = CalculatedDistanceModel(
            address_origin = vehicle_base_address,
            address_destination = customer_origin_address,
            kilometers = base_to_origin_distance
        )
        db.session.add(vehicle_base_to_customer_origin_distance)
        db.session.commit()

        customer_origin_to_customer_destination_distance = CalculatedDistanceModel(
            address_origin = customer_origin_address,
            address_destination = customer_destination_address,
            kilometers = origin_to_destination_distance
        )
        db.session.add(customer_origin_to_customer_destination_distance)
        db.session.commit()

        customer_destination_to_vehicle_base_distance = CalculatedDistanceModel(
            address_origin = customer_destination_address,
            address_destination = vehicle_base_address,
            kilometers = destination_to_base_distance
        )
        db.session.add(customer_destination_to_vehicle_base_distance)
        db.session.commit()

        return