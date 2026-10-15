"""Eliminar vehículos: solo admin, y solo cuando nada lo necesita.

Las cotizaciones no guardan qué vehículo va: el API principal toma el primero
de la empresa. Si una empresa con cotizaciones se queda sin vehículos, esas
cotizaciones dejan de verse para el cliente, sin ningún error que avise.
"""
from app import db
from app.models import Order, Quotation, Vehicle
from tests.test_service_requests import make_user
from tests.test_services_per_company import catalog, make_company, superadmin  # noqa: F401


def add_vehicle(company, brand='Hyundai'):
    vehicle = Vehicle(carrier_company_id=company.id, brand=brand, active=1)
    db.session.add(vehicle)
    db.session.commit()
    return vehicle


def add_quotation(company, vehicle=None):
    order = Order(order_status_id=1)
    db.session.add(order)
    db.session.commit()
    db.session.add(Quotation(amount=450, order_id=order.id, carrier_company_id=company.id,
                             vehicle_id=vehicle.id if vehicle else None))
    db.session.commit()


def delete(client, vehicle, headers):
    return client.delete(f'/api/carrier-companies/{vehicle.carrier_company_id}/vehicles/{vehicle.id}',
                         headers=headers)


def test_admin_deletes_a_vehicle_nothing_needs(client, catalog):  # noqa: F811
    company = make_company('Mudanzas SAC', 'moving')
    vehicle = add_vehicle(company)

    res = delete(client, vehicle, make_user('admin'))

    assert res.status_code == 200
    assert Vehicle.query.count() == 0


def test_a_carrier_cannot_delete_its_own_vehicle(client, catalog):  # noqa: F811
    company = make_company('Mudanzas SAC', 'moving')
    vehicle = add_vehicle(company)
    carrier = make_user('carrier_company', carrier_company_id=company.id)

    res = delete(client, vehicle, carrier)

    assert res.status_code == 403
    assert Vehicle.query.count() == 1


def test_the_last_vehicle_of_a_company_with_quotations_stays(client, catalog, superadmin):  # noqa: F811
    company = make_company('Mudanzas SAC', 'moving')
    vehicle = add_vehicle(company)
    add_quotation(company)

    res = delete(client, vehicle, superadmin)

    assert res.status_code == 409
    assert res.get_json()['message'] == 'last vehicle of a company with quotations'
    assert Vehicle.query.count() == 1


def test_one_of_several_vehicles_can_go_even_with_quotations(client, catalog, superadmin):  # noqa: F811
    company = make_company('Mudanzas SAC', 'moving')
    vehicle = add_vehicle(company)
    add_vehicle(company, brand='JAC')
    add_quotation(company)

    res = delete(client, vehicle, superadmin)

    assert res.status_code == 200
    assert [v.brand for v in Vehicle.query.all()] == ['JAC']


def test_a_vehicle_a_quotation_points_to_stays(client, catalog, superadmin):  # noqa: F811
    company = make_company('Mudanzas SAC', 'moving')
    vehicle = add_vehicle(company)
    add_vehicle(company, brand='JAC')
    add_quotation(company, vehicle=vehicle)

    res = delete(client, vehicle, superadmin)

    assert res.status_code == 409
    assert res.get_json()['message'] == 'vehicle has quotations'
    assert Vehicle.query.count() == 2


def test_a_vehicle_of_another_company_is_not_found(client, catalog, superadmin):  # noqa: F811
    company = make_company('Mudanzas SAC', 'moving')
    other = make_company('Otra SAC', 'moving')
    vehicle = add_vehicle(company)

    res = client.delete(f'/api/carrier-companies/{other.id}/vehicles/{vehicle.id}', headers=superadmin)

    assert res.status_code == 404
    assert Vehicle.query.count() == 1
