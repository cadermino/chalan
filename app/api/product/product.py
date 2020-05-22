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