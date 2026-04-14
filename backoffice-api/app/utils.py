from .models import CarrierCompany, Vehicle
from . import db


def create_blank_company_and_vehicle(email=''):
    """Create a blank CarrierCompany + one blank Vehicle. Returns the company.
    Caller is responsible for committing the session.
    """
    company = CarrierCompany(name='Nueva empresa', rfc='', email=email, address='', active=0)
    db.session.add(company)
    db.session.flush()  # get company.id before the outer commit
    vehicle = Vehicle(carrier_company_id=company.id, active=0)
    db.session.add(vehicle)
    return company
