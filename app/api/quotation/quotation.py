from flask import jsonify
from .quotation_status import QuotationStatus
from ..carrier_company import CarrierCompany as CarrierCompanyEntity
from ...models import Quotations as QuotationsModel
from ... import db

class Quotation:
    def __init__(self, quotation_id=None):
        self.quotation_id = quotation_id
        self.quotations = None

    def create(self, quotationData):
        quotation = QuotationsModel(
            amount = quotationData['amount'],
            order_id = quotationData['order_id'],
            carrier_company_id = quotationData['carrier_company_id'],
        )
        db.session.add(quotation)
        db.session.commit()
        return quotation

    def update(self, quotationData):
        quotation = QuotationsModel.query.\
            filter(QuotationsModel.id == self.quotation_id).\
            update(quotationData)
        db.session.commit()
        return quotation

    def get(self, order_id=None, carrier_company_id=None):
        quotation = QuotationsModel.query.\
            filter(QuotationsModel.order_id == order_id).\
            filter(QuotationsModel.carrier_company_id == carrier_company_id).\
            filter(QuotationsModel.quotation_status_id != QuotationStatus.Cancelled()).first()

        return quotation

    def listByOrderId(self, order_id):
        self.quotations = QuotationsModel.query.\
            filter(QuotationsModel.order_id == order_id).\
            filter(QuotationsModel.quotation_status_id != QuotationStatus.Cancelled()).\
            all()
        return self

    def pickQuotation(self, quotation_id=None):
        picked_quotation = QuotationsModel.query.get(self.quotation_id)
        quotations = picked_quotation.order.quotations
        for quotation in quotations:
            if quotation.quotation_status_id == QuotationStatus.Selected():
                quotation.quotation_status_id = QuotationStatus.Active()
                db.session.add(quotation)
        picked_quotation.quotation_status_id = QuotationStatus.Selected()
        db.session.add(picked_quotation)
        db.session.commit()

    def generate_quotation_url(self, order_id, carrier_company_id, site_url):
        return site_url + 'quotation/' + CarrierCompanyEntity().generate_carrier_company_token(864000, order_id, carrier_company_id)

    def toJson(self):
        output = []
        for quotation in self.quotations:
            carrier_company = quotation.carrier_company
            vehicle = carrier_company.vehicles
            if quotation.quotation_status_id == QuotationStatus.Selected():
                selected = True
            else:
                selected = False
            output.append({
                'id': quotation.id,
                'amount': quotation.amount,
                'selected': selected,
                'order_id': quotation.order_id,
                'carrier_company_id': quotation.carrier_company.id,
                'size': vehicle[0].size,
                'weight': vehicle[0].weight,
                'brand': vehicle[0].brand,
                'model': vehicle[0].model,
                'picture': vehicle[0].picture
            })

        return jsonify(output)