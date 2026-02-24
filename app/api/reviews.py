import os
from flask import jsonify, request
from . import api
from .. import db
from ..models import Review, ReviewSchema, Order, CarrierCompany, Customer, CarrierCompanySchema
from sqlalchemy import func


@api.route('/reviews', methods=['POST'])
def create_review():
    data = request.get_json()

    # Validate required fields
    required = ['order_id', 'carrier_company_id', 'rating', 'comment']
    for field in required:
        if field not in data:
            return jsonify({'error': f'Campo requerido: {field}'}), 400

    rating = data['rating']
    if not isinstance(rating, int) or rating < 1 or rating > 5:
        return jsonify({'error': 'La calificación debe ser entre 1 y 5'}), 400

    # Verify the order exists
    order = db.session.get(Order, data['order_id'])
    if not order:
        return jsonify({'error': 'Orden no encontrada'}), 404

    # Verify the carrier company exists
    carrier = db.session.get(CarrierCompany, data['carrier_company_id'])
    if not carrier:
        return jsonify({'error': 'Empresa no encontrada'}), 404

    # Verify order belongs to a customer
    if not order.customer_id:
        return jsonify({'error': 'Orden sin cliente asociado'}), 400

    # Check if review already exists for this order+customer
    existing = Review.query.filter_by(
        order_id=data['order_id'],
        customer_id=order.customer_id
    ).first()
    if existing:
        return jsonify({'error': 'Ya publicaste una reseña para esta orden'}), 409

    review = Review(
        order_id=data['order_id'],
        customer_id=order.customer_id,
        carrier_company_id=data['carrier_company_id'],
        rating=rating,
        comment=data['comment'][:1000]
    )
    db.session.add(review)
    db.session.commit()

    return jsonify({'message': 'Reseña publicada exitosamente', 'id': review.id}), 201


@api.route('/reviews/company/<int:company_id>', methods=['GET'])
def get_company_reviews(company_id):
    carrier = db.session.get(CarrierCompany, company_id)
    if not carrier:
        return jsonify({'error': 'Empresa no encontrada'}), 404

    reviews = Review.query.filter_by(carrier_company_id=company_id)\
        .order_by(Review.created_date.desc()).all()

    avg_rating = db.session.query(func.avg(Review.rating))\
        .filter(Review.carrier_company_id == company_id).scalar() or 0

    reviews_data = []
    for r in reviews:
        customer = db.session.get(Customer, r.customer_id)
        reviews_data.append({
            'id': r.id,
            'rating': r.rating,
            'comment': r.comment,
            'customer_name': f"{customer.name} {customer.paternal_last_name[0]}." if customer and customer.paternal_last_name else (customer.name if customer else "Anónimo"),
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
        func.count(Review.id).label('total_reviews')
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
        })

    return jsonify(companies)


@api.route('/reviews/recent', methods=['GET'])
def get_recent_reviews():
    reviews = Review.query.order_by(Review.created_date.desc()).limit(10).all()

    reviews_data = []
    for r in reviews:
        customer = db.session.get(Customer, r.customer_id)
        carrier = db.session.get(CarrierCompany, r.carrier_company_id)
        reviews_data.append({
            'id': r.id,
            'rating': r.rating,
            'comment': r.comment,
            'customer_name': f"{customer.name} {customer.paternal_last_name[0]}." if customer and customer.paternal_last_name else (customer.name if customer else "Anónimo"),
            'carrier_company_name': carrier.name if carrier else "Desconocida",
            'carrier_company_id': r.carrier_company_id,
            'created_date': r.created_date.isoformat() if r.created_date else None,
        })

    return jsonify(reviews_data)
