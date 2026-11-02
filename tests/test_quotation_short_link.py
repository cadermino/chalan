"""Link corto para cotizar (chalan.pe/c/<orden>-<empresa>-<firma>).

Lo que se prueba es que se canjee por el mismo JWT del link largo, que no se
pueda cambiar un número para abrir otra orden o cotizar a nombre de otra
empresa, y que el backoffice-api arme el mismo código.
"""
import importlib.util
from pathlib import Path

import jwt
import pytest

from app.api.quotation_short_link import make_code


def redeem(client, code):
    return client.get(f'/api/v1/quotation-links/{code}')


def test_the_code_gives_the_quotation_token_of_that_order_and_company(app, client, order, carrier_company):
    res = redeem(client, make_code(order.id, carrier_company.id))

    assert res.status_code == 200
    token = jwt.decode(res.get_json()['token'], app.config['SECRET_KEY'], algorithms=['HS256'])
    assert (token['order_id'], token['carrier_company_id']) == (order.id, carrier_company.id)


def test_the_link_is_short(app, order, carrier_company):
    assert len(f'https://chalan.pe/c/{make_code(order.id, carrier_company.id)}') < 45


def test_changing_a_number_breaks_the_signature(app, client, order, carrier_company):
    signature = make_code(order.id, carrier_company.id).split('-', 2)[2]

    assert redeem(client, f'{order.id}-{carrier_company.id + 1}-{signature}').status_code == 404
    assert redeem(client, f'{order.id + 1}-{carrier_company.id}-{signature}').status_code == 404


@pytest.mark.parametrize('code', ['nada', '1-1', '1-1-', 'a-b-cdefghijkl'])
def test_a_made_up_code_is_rejected(client, code):
    assert redeem(client, code).status_code == 404


def test_a_signed_code_for_an_order_that_no_longer_exists_is_404(app, client, carrier_company):
    assert redeem(client, make_code(999, carrier_company.id)).status_code == 404


def test_the_backoffice_makes_the_same_code(app):
    path = Path(__file__).resolve().parents[1] / 'backoffice-api' / 'app' / 'quotation_short_link.py'
    if not path.exists():
        pytest.skip('backoffice-api is not mounted in this container')
    spec = importlib.util.spec_from_file_location('backoffice_quotation_short_link', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    assert module.make_code(12, 3) == make_code(12, 3)
