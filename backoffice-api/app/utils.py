import os

from .models import CarrierCompany, Vehicle
from . import db


# CarrierCompany.name es String(45); un nombre más largo reventaría el insert.
_COMPANY_NAME_MAX = 45
_DEFAULT_COMPANY_NAME = 'Nueva empresa'


def _company_name_from(person_name):
    """Nombre inicial de la empresa: el de quien la registra.

    Antes todas nacían como "Nueva empresa" y en la lista del backoffice las
    altas de la landing quedaban indistinguibles entre sí. Es un nombre
    provisional igual — el transportista lo cambia por el de su empresa al
    completar su perfil — pero mientras tanto se sabe de quién es cada una.
    """
    name = ' '.join((person_name or '').split())
    return name[:_COMPANY_NAME_MAX] if name else _DEFAULT_COMPANY_NAME


def create_blank_company_and_vehicle(email='', phone='', person_name=''):
    """Create a blank CarrierCompany + one blank Vehicle. Returns the company.
    Caller is responsible for committing the session.

    country_id must be set here — CarrierCompany.country_id is what
    app/api/orders.py's get_carrier_companies() filters on to decide who
    gets notified of new orders. A carrier left with country_id=NULL is
    silently excluded from all notifications forever, even once active.
    """
    country_id = os.getenv('COUNTRY_ID')
    company = CarrierCompany(
        name=_company_name_from(person_name), rfc='', email=email, phone=phone,
        address='', active=0,
        country_id=int(country_id) if country_id else None,
    )
    db.session.add(company)
    db.session.flush()  # get company.id before the outer commit
    vehicle = Vehicle(carrier_company_id=company.id, active=0)
    db.session.add(vehicle)
    return company
