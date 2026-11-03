from flask import jsonify
from sqlalchemy import func
from .quotation_status import QuotationStatus
from ..carrier_company import CarrierCompany as CarrierCompanyEntity
from ..carrier_documents import DOC_TYPES
from ..order.order_status import OrderStatus
from ..service_request.validation import without_phones
from ...models import CarrierDocument, Order, Quotations as QuotationsModel
from ... import db


def _trust(company_ids):
    """Lo que muestra la tarjeta de cotización junto a las estrellas (o en vez
    de ellas, a una empresa sin reseñas): {empresa: (documentos, mudanzas)}.

    Documentos: subió DNI o CE, licencia y tarjeta de propiedad. Mudanzas: sus
    cotizaciones elegidas en órdenes completadas.
    """
    if not company_ids:
        return {}
    docs = dict(db.session.query(CarrierDocument.carrier_company_id,
                                 func.count(func.distinct(CarrierDocument.doc_type)))
                .filter(CarrierDocument.carrier_company_id.in_(company_ids),
                        CarrierDocument.doc_type.in_(DOC_TYPES))
                .group_by(CarrierDocument.carrier_company_id).all())
    moves = dict(db.session.query(QuotationsModel.carrier_company_id, func.count(QuotationsModel.id))
                 .join(Order, Order.id == QuotationsModel.order_id)
                 .filter(QuotationsModel.carrier_company_id.in_(company_ids),
                         QuotationsModel.quotation_status_id == QuotationStatus.Selected(),
                         Order.order_status_id == OrderStatus.completed())
                 .group_by(QuotationsModel.carrier_company_id).all())
    return {company_id: (docs.get(company_id, 0) == len(DOC_TYPES), moves.get(company_id, 0))
            for company_id in company_ids}


class Quotation:
    def __init__(self, quotation_id=None):
        self.quotation_id = quotation_id
        self.quotations = None

    def create(self, quotationData):
        quotation = QuotationsModel(
            amount = quotationData['amount'],
            order_id = quotationData['order_id'],
            carrier_company_id = quotationData['carrier_company_id'],
            note = quotationData.get('note'),
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
        picked_quotation = db.session.get(QuotationsModel, self.quotation_id)
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

    def toJson(self, commission_rate=0, platform_fee=0):
        output = []
        trust = _trust({quotation.carrier_company_id for quotation in self.quotations})
        for quotation in self.quotations:
            carrier_company = quotation.carrier_company
            vehicles = carrier_company.vehicles
            if not vehicles:
                continue
            vehicle = vehicles[0]
            selected = quotation.quotation_status_id == QuotationStatus.Selected()
            total_amount = round(quotation.amount * (1 + commission_rate + platform_fee), 2)
            documents_verified, completed_moves = trust[carrier_company.id]
            output.append({
                'id': quotation.id,
                'amount': quotation.amount,
                'total_amount': total_amount,
                # Sin teléfonos: con el número lo contratan sin pasar por Chalán.
                'note': without_phones(quotation.note),
                'selected': selected,
                'order_id': quotation.order_id,
                'carrier_company_id': carrier_company.id,
                'size': vehicle.size,
                # weight es el campo viejo de texto libre; el cliente ve
                # payload_tons cuando el vehículo ya tiene los datos de la tarjeta.
                'weight': vehicle.weight,
                'payload_tons': float(vehicle.payload_tons) if vehicle.payload_tons is not None else None,
                # cargo_cover y no body_type: la carrocería de la tarjeta no
                # dice si hoy la carga va cerrada (migración 024).
                'cargo_cover': vehicle.cargo_cover,
                'manufacture_year': vehicle.manufacture_year,
                'brand': vehicle.brand,
                'model': vehicle.model,
                'picture': vehicle.picture,
                'documents_verified': documents_verified,
                'completed_moves': completed_moves,
            })

        return jsonify(output)