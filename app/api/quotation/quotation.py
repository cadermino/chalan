from flask import jsonify
from ...models import Quotations as QuotationsModel
from ... import db

class Quotation:
    def __init__(self, quotation_id=None):
        self.quotation_id = quotation_id
        self.quotations = None

    def listByOrderId(self, order_id):
        self.quotations = QuotationsModel.query.filter_by(order_id = order_id).all()
        return self
    
    def pickQuotation(self, quotation_id=None):
        picked_quotation = QuotationsModel.query.get(self.quotation_id)
        quotations = picked_quotation.order.quotations
        for quotation in quotations:
            quotation.selected = False
            db.session.add(quotation)
        picked_quotation.selected = True
        db.session.add(picked_quotation)
        db.session.commit()

    def toJson(self):
        output = []
        for quotation in self.quotations:
            vehicle = quotation.vehicle
            output.append({
                'id': quotation.id,
                'amount': quotation.amount,
                'order_id': quotation.order_id,
                'vehicle_id': quotation.vehicle_id,
                'size': vehicle.size,
                'weight': vehicle.weight,
                'brand': vehicle.brand,
                'model': vehicle.model,
                'picture': vehicle.picture
            })
        
        return jsonify(output)