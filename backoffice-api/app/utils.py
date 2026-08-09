import os

from .models import CarrierCompany, Vehicle
from . import db


def create_blank_company_and_vehicle(email='', phone=''):
    """Create a blank CarrierCompany + one blank Vehicle. Returns the company.
    Caller is responsible for committing the session.

    country_id must be set here — CarrierCompany.country_id is what
    app/api/orders.py's get_carrier_companies() filters on to decide who
    gets notified of new orders. A carrier left with country_id=NULL is
    silently excluded from all notifications forever, even once active.
    """
    country_id = os.getenv('COUNTRY_ID')
    company = CarrierCompany(
        name='Nueva empresa', rfc='', email=email, phone=phone, address='', active=0,
        country_id=int(country_id) if country_id else None,
    )
    db.session.add(company)
    db.session.flush()  # get company.id before the outer commit
    vehicle = Vehicle(carrier_company_id=company.id, active=0)
    db.session.add(vehicle)
    return company
