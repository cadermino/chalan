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
            carrier_company = quotation.carrier_company
            vehicle = carrier_company.vehicles
            output.append({
                'id': quotation.id,
                'amount': quotation.amount,
                'selected': quotation.selected,
                'order_id': quotation.order_id,
                'carrier_company_id': quotation.carrier_company.id,
                'size': vehicle[0].size,
                'weight': vehicle[0].weight,
                'brand': vehicle[0].brand,
                'model': vehicle[0].model,
                'picture': vehicle[0].picture
            })

        return jsonify(output)