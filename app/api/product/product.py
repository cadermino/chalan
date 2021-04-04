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
        vehicle = VehicleModel.query.get(data['vehicle_id'])
        order_details = OrderModel.query.get(data['order_id']).order_details
        order_details_from = order_details.filter_by(type = 'carry_from').first()
        order_details_to = order_details.filter_by(type = 'deliver_to').first()
        total_floors = order_details_from.floor_number + order_details_to.floor_number

        vehicle_base_address = vehicle.base_address
        customer_origin_address = '{} {} {} {}'.format(order_details_from.neighborhood, order_details_from.zip_code, order_details_from.city, order_details_from.state)
        customer_destination_address = '{} {} {} {}'.format(order_details_to.neighborhood, order_details_to.zip_code, order_details_to.city, order_details_to.state)
        
        base_to_origin_distance = CalculatedDistanceModel.query.filter_by(address_origin = vehicle_base_address).filter_by(address_destination = customer_origin_address).first()
        origin_to_destination_distance = CalculatedDistanceModel.query.filter_by(address_origin = customer_origin_address).filter_by(address_destination = customer_destination_address).first()
        destination_to_base_distance = CalculatedDistanceModel.query.filter_by(address_origin = customer_destination_address).filter_by(address_destination = vehicle_base_address).first()
        total_kilometers = base_to_origin_distance.kilometers + origin_to_destination_distance.kilometers + destination_to_base_distance.kilometers

        amount = self.__calculate_product_amount(vehicle, total_floors, total_kilometers)
        
        if data['product_id'] is not None:
            product = ProductModel.query.get(data['product_id'])
            product.vehicle_id = data['vehicle_id']
            product.price = amount
            product.total_kilometers = total_kilometers
            product.active = data['active']

        else:
            product = ProductModel(
                vehicle_id = data['vehicle_id'],
                price = amount,
                total_kilometers = total_kilometers,
                active = data['active']
            )
        db.session.add(product)
        db.session.commit()
        
        return product


    def generate_products(self, filters, order_id):
        vehicles = VehicleModel.query.filter(VehicleModel.active == 1).all()
        
        customer_origin_address = '{} {} {} {}'.format(filters['from_neighborhood'], filters['from_zip_code'], filters['from_city'], filters['from_state'])
        customer_destination_address = '{} {} {} {}'.format(filters['to_neighborhood'], filters['to_zip_code'], filters['to_city'], filters['to_state'])
        origin_to_destination_distance = CalculatedDistanceModel.query.filter_by(address_origin = customer_origin_address).filter_by(address_destination = customer_destination_address).first()
        
        output = []
        for vehicle in vehicles:

            vehicle_base_address = vehicle.base_address
            
            base_to_origin_distance = CalculatedDistanceModel.query.filter_by(address_origin = vehicle_base_address).filter_by(address_destination = customer_origin_address).first()
            destination_to_base_distance = CalculatedDistanceModel.query.filter_by(address_origin = customer_destination_address).filter_by(address_destination = vehicle_base_address).first()
            
            if None in [base_to_origin_distance, origin_to_destination_distance, destination_to_base_distance]:
                result = self.__calculate_kilometers_google(
                    vehicle_base_address,
                    customer_origin_address,
                    customer_destination_address
                )
                self.__persist_distances(vehicle_base_address, customer_origin_address, result['base_to_origin_distance'])
                self.__persist_distances(customer_origin_address, customer_destination_address, result['origin_to_destination_distance'])
                self.__persist_distances(customer_destination_address, vehicle_base_address, result['destination_to_base_distance'])
                total_kilometers = result['base_to_origin_distance'] + result['origin_to_destination_distance'] + result['destination_to_base_distance']
            else:
                total_kilometers = base_to_origin_distance.kilometers + origin_to_destination_distance.kilometers + destination_to_base_distance.kilometers
            
            total_floors = int(filters['from_floor']) + int(filters['to_floor'])

            amount = self.__calculate_product_amount(vehicle, total_floors, total_kilometers)

            output.append({    
                'kms': total_kilometers,         
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

    def __persist_distances(self, origin, destination, kilometers):
        calculatedDistance = CalculatedDistanceModel(
            address_origin = origin,
            address_destination = destination,
            kilometers = kilometers
        )
        db.session.add(calculatedDistance)
        db.session.commit()

        return True

    def __calculate_kilometers_google(self, vehicle_base_address, customer_origin_address, customer_destination_address):
        origins = '{}|{}|{}'.format(vehicle_base_address, customer_origin_address, customer_destination_address)
        destinations = '{}|{}|{}'.format(customer_origin_address, customer_destination_address, vehicle_base_address)
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
        base_to_origin_distance = data['rows'][0]['elements'][0]['distance']['value']/1000
        origin_to_destination_distance = data['rows'][1]['elements'][1]['distance']['value']/1000
        destination_to_base_distance = data['rows'][2]['elements'][2]['distance']['value']/1000
        
        return {
            'base_to_origin_distance': base_to_origin_distance,
            'origin_to_destination_distance': origin_to_destination_distance,
            'destination_to_base_distance': destination_to_base_distance
        }

    def __calculate_product_amount(self, vehicle, total_floors, total_kilometers):
        driver_fee = vehicle.driver_fee
        loader_fee = vehicle.loader_fee
        loaders_quantity = vehicle.loaders_quantity
        kilometers_fee = vehicle.charge_per_kilometer
        floor_fee = vehicle.charge_per_floor
        chalan_fee = 300
        working_days = 1
        if total_kilometers > 500:
            working_days = 2

        gross_payment = chalan_fee + (driver_fee * working_days) + (loader_fee * loaders_quantity * working_days) + (kilometers_fee * total_kilometers) + (floor_fee * total_floors)
        stripe_commission = gross_payment * 0.042
        total = gross_payment + stripe_commission
        
        return total