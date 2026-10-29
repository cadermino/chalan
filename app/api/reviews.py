import os
import jwt
from flask import jsonify, request, current_app
from . import api
from .. import db
from ..models import (Review, ReviewSchema, Order, CarrierCompany, Customer, CarrierCompanySchema, Quotations,
                      ServiceRequest)
from .order.order_status import OrderStatus
from .quotation.quotation_status import QuotationStatus
from .service_request.reviews import reviewed_quotation
from .service_requests import _public_name
from sqlalchemy import func


REVIEW_PURPOSE = 'review'


def _service_review_target(token_data):
    """El servicio y la empresa de un token de servicio, mientras el link valga:
    el servicio sigue completado y la elegida es de esa empresa."""
    service_request = db.session.get(ServiceRequest, token_data.get('service_request_id'))
    quotation = reviewed_quotation(service_request)
    if quotation is None or quotation.carrier_company_id != token_data.get('carrier_company_id'):
        return None, None
    return service_request, quotation.carrier_company


def _order_review_target(token_data):
    """La orden y la empresa de un token de mudanza, si coinciden con lo que
    pasó: la orden es de ese cliente, está completada y la elegida es de esa
    empresa. Los links de cotizar de los transportistas traen order_id y
    carrier_company_id pero no customer_id."""
    order = db.session.get(Order, token_data.get('order_id'))
    if order is None or not order.customer_id or order.customer_id != token_data.get('customer_id'):
        return None, None
    if order.order_status_id != OrderStatus.completed():
        return None, None
    selected = Quotations.query.filter_by(order_id=order.id, quotation_status_id=QuotationStatus.Selected()).first()
    if selected is None or selected.carrier_company_id != token_data.get('carrier_company_id'):
        return None, None
    return order, db.session.get(CarrierCompany, selected.carrier_company_id)


def _read_review_token(token):
    """Lo que reseña un link: ('service', solicitud, empresa) u ('order', orden,
    empresa), o None.

    Los JWT de las dos apps (links de cotizar, sesiones, el token interno) se
    firman con el mismo SECRET_KEY, así que una firma buena no basta: el link de
    reseña lleva `purpose: review`. Los de mudanza que se mandaron antes de eso
    no lo traen y valen mientras coincidan con la orden (_order_review_target)."""
    if not isinstance(token, str) or not token:
        return None
    try:
        data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
    except jwt.InvalidTokenError:
        return None
    purpose = data.get('purpose')
    if 'service_request_id' in data:
        # El link del transportista de un servicio también trae service_request_id.
        if purpose != REVIEW_PURPOSE:
            return None
        service_request, carrier = _service_review_target(data)
        return ('service', service_request, carrier) if service_request else None
    if purpose not in (None, REVIEW_PURPOSE):
        return None
    order, carrier = _order_review_target(data)
    return ('order', order, carrier) if order else None


def _short_name(first, last=None):
    """'Carla R.': lo que se publica del cliente."""
    words = (first or '').split()
    if last:
        words = words[:1] + last.split()[:1]
    if not words:
        return 'Anónimo'
    return f'{words[0]} {words[1][0]}.' if len(words) > 1 else words[0]


def _reviewer_name(review):
    if review.service_request_id:
        return _short_name(review.service_request.customer_name if review.service_request else None)
    customer = db.session.get(Customer, review.customer_id) if review.customer_id else None
    return _short_name(customer.name, customer.paternal_last_name) if customer else 'Anónimo'


def _review_fields(data):
    """Calificación y comentarios, validados igual para mudanzas y servicios."""
    if 'rating' not in data or 'comment' not in data:
        missing = 'rating' if 'rating' not in data else 'comment'
        return None, (jsonify({'error': f'Campo requerido: {missing}'}), 400)
    rating = data['rating']
    if not isinstance(rating, int) or isinstance(rating, bool) or rating < 1 or rating > 5:
        return None, (jsonify({'error': 'La calificación debe ser entre 1 y 5'}), 400)
    platform_rating = data.get('platform_rating')
    if platform_rating is not None and (not isinstance(platform_rating, int) or isinstance(platform_rating, bool)
                                        or platform_rating < 1 or platform_rating > 5):
        return None, (jsonify({'error': 'La calificación de la plataforma debe ser entre 1 y 5'}), 400)
    comment = data['comment'] if isinstance(data['comment'], str) else ''
    platform_comment = data.get('platform_comment') if isinstance(data.get('platform_comment'), str) else None
    return {
        'rating': rating,
        'comment': comment[:1000],
        'platform_rating': platform_rating,
        'platform_comment': platform_comment[:1000] if platform_comment else None,
    }, None


def _existing_review(kind, subject):
    if kind == 'service':
        return Review.query.filter_by(service_request_id=subject.id).first()
    return Review.query.filter_by(order_id=subject.id, customer_id=subject.customer_id).first()


@api.route('/reviews/verify/<token>', methods=['GET'])
def verify_review_token(token):
    target = _read_review_token(token)
    if target is None:
        return jsonify({'error': 'Link inválido o expirado'}), 400
    kind, subject, carrier = target

    if kind == 'service':
        return jsonify({
            'service_request_id': subject.id,
            'carrier_company_id': carrier.id,
            # A un contacto que cargó el admin se lo nombra por quien contesta.
            'carrier_company_name': _public_name(carrier),
            'service_name': subject.service_type.name if subject.service_type else None,
            'already_reviewed': _existing_review(kind, subject) is not None,
        }), 200

    return jsonify({
        'order_id': subject.id,
        'carrier_company_id': carrier.id,
        'carrier_company_name': carrier.name,
        'already_reviewed': _existing_review(kind, subject) is not None,
    }), 200


@api.route('/reviews', methods=['POST'])
def create_review():
    """Solo con el link de reseña: antes, sin token bastaba mandar order_id y
    carrier_company_id para reseñar cualquier orden."""
    data = request.get_json(silent=True) or {}
    target = _read_review_token(data.get('token'))
    if target is None:
        return jsonify({'error': 'Link inválido o expirado'}), 400
    kind, subject, carrier = target

    fields, error = _review_fields(data)
    if error:
        return error
    if _existing_review(kind, subject):
        what = 'este servicio' if kind == 'service' else 'esta orden'
        return jsonify({'error': f'Ya publicaste una reseña para {what}'}), 409

    if kind == 'service':
        review = Review(service_request_id=subject.id, carrier_company_id=carrier.id, **fields)
    else:
        review = Review(order_id=subject.id, customer_id=subject.customer_id, carrier_company_id=carrier.id, **fields)
    db.session.add(review)
    db.session.commit()

    return jsonify({'message': 'Reseña publicada exitosamente', 'id': review.id}), 201


@api.route('/reviews/company/<int:company_id>', methods=['GET'])
def get_company_reviews(company_id):
    carrier = db.session.get(CarrierCompany, company_id)
    # Una inactiva (un contacto que cargó el admin) no tiene ficha pública: su
    # nombre de negocio es justo lo que el cliente no tiene que ver.
    if not carrier or not carrier.active:
        return jsonify({'error': 'Empresa no encontrada'}), 404

    reviews = Review.query.filter_by(carrier_company_id=company_id)\
        .order_by(Review.created_date.desc()).all()

    avg_rating = db.session.query(func.avg(Review.rating))\
        .filter(Review.carrier_company_id == company_id).scalar() or 0

    reviews_data = []
    for r in reviews:
        reviews_data.append({
            'id': r.id,
            'rating': r.rating,
            'comment': r.comment,
            'customer_name': _reviewer_name(r),
            'created_date': r.created_date.isoformat() if r.created_date else None,
        })

    carrier_schema = CarrierCompanySchema()
    carrier_data = carrier_schema.dump(carrier)
    carrier_data['average_rating'] = round(float(avg_rating), 1)
    carrier_data['total_reviews'] = len(reviews)
    carrier_data['reviews'] = reviews_data

    return jsonify(carrier_data)


@api.route('/reviews/top-companies', methods=['GET'])
def get_top_companies():
    country_id = os.getenv('COUNTRY_ID', '1')

    results = db.session.query(
        CarrierCompany.id,
        CarrierCompany.name,
        CarrierCompany.description,
        CarrierCompany.cover_image,
        func.avg(Review.rating).label('average_rating'),
        func.count(Review.id).label('total_reviews')
    ).join(Review, Review.carrier_company_id == CarrierCompany.id)\
     .filter(CarrierCompany.country_id == int(country_id))\
     .filter(CarrierCompany.active == 1)\
     .group_by(CarrierCompany.id, CarrierCompany.name,
               CarrierCompany.description, CarrierCompany.cover_image)\
     .order_by(func.avg(Review.rating).desc())\
     .limit(6).all()

    companies = []
    for r in results:
        companies.append({
            'id': r.id,
            'name': r.name,
            'description': r.description or '',
            'cover_image': r.cover_image,
            'average_rating': round(float(r.average_rating), 1),
            'total_reviews': r.total_reviews,
        })

    return jsonify(companies)


@api.route('/reviews/companies', methods=['GET'])
def get_all_companies_with_ratings():
    """List all active carrier companies with their average rating and review count."""
    country_id = os.getenv('COUNTRY_ID', '1')

    # Left outer join to include companies without reviews
    results = db.session.query(
        CarrierCompany.id,
        CarrierCompany.name,
        CarrierCompany.description,
        CarrierCompany.cover_image,
        func.coalesce(func.avg(Review.rating), 0).label('average_rating'),
        func.count(Review.id).label('total_reviews'),
        func.max(Review.created_date).label('last_review_date')
    ).outerjoin(Review, Review.carrier_company_id == CarrierCompany.id)\
     .filter(CarrierCompany.country_id == int(country_id))\
     .filter(CarrierCompany.active == 1)\
     .group_by(CarrierCompany.id, CarrierCompany.name,
               CarrierCompany.description, CarrierCompany.cover_image)\
     .order_by(func.count(Review.id).desc(), CarrierCompany.name)\
     .all()

    companies = []
    for r in results:
        companies.append({
            'id': r.id,
            'name': r.name,
            'description': r.description or '',
            'cover_image': r.cover_image,
            'average_rating': round(float(r.average_rating), 1),
            'total_reviews': r.total_reviews,
            'last_review_date': r.last_review_date.isoformat() if r.last_review_date else None,
        })

    return jsonify(companies)


@api.route('/reviews/recent', methods=['GET'])
def get_recent_reviews():
    # Solo de empresas activas: cada una enlaza a su ficha, y la de un contacto
    # inactivo no es pública.
    reviews = Review.query.join(CarrierCompany, Review.carrier_company_id == CarrierCompany.id)\
        .filter(CarrierCompany.active == 1)\
        .order_by(Review.created_date.desc()).limit(10).all()

    reviews_data = []
    for r in reviews:
        carrier = db.session.get(CarrierCompany, r.carrier_company_id)
        reviews_data.append({
            'id': r.id,
            'rating': r.rating,
            'comment': r.comment,
            'customer_name': _reviewer_name(r),
            'carrier_company_name': carrier.name if carrier else "Desconocida",
            'carrier_company_id': r.carrier_company_id,
            'created_date': r.created_date.isoformat() if r.created_date else None,
        })

    return jsonify(reviews_data)
