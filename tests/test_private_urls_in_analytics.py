"""The three frontends hide the credentials in their URLs from GA4 with copies
of one regex (privateUrl in each app). If they drift, a link that one app
cleans leaks from another as the previous page (page_referrer)."""
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'frontend' / 'src' / 'utils' / 'privateUrl.js',
    ROOT / 'frontend-react' / 'src' / 'lib' / 'privateUrl.ts',
    ROOT / 'services-web' / 'src' / 'privateUrl.js',
]


def _regex(path, name):
    if not path.exists():
        pytest.skip(f'{path.parent.name} is not mounted in this container')
    found = re.search(rf'^export const {name} = /(.+)/(g?i?);?$', path.read_text(), re.MULTILINE)
    assert found, f'{name} not found in {path}'
    return found.group(1), found.group(2)


@pytest.mark.parametrize('name', ['PRIVATE_SEGMENT', 'JWT'])
def test_the_three_apps_use_the_same_rule(name):
    assert len({_regex(path, name) for path in COPIES}) == 1


def _clean(url):
    segment, _ = _regex(COPIES[0], 'PRIVATE_SEGMENT')
    jwt, _ = _regex(COPIES[0], 'JWT')
    # The JS regexes are plain enough to read the same in Python, minus the
    # escaped slashes a JS literal needs.
    url = re.sub(segment.replace('\\/', '/'), r'\1:token', url, flags=re.IGNORECASE)
    return re.sub(jwt, ':token', url)


@pytest.mark.parametrize('url, expected', [
    ('https://chalan.pe/acceso/WzE0NCwyMV0.aBc-d_e?r=whatsapp', 'https://chalan.pe/acceso/:token?r=whatsapp'),
    ('https://chalan.pe/quotation/eyJhbGciOi.eyJvcmRlcl9pZCI6.sIgN', 'https://chalan.pe/quotation/:token'),
    ('https://chalan.pe/quotation/eyJhbGciOi.eyJvcmRlcl9pZCI6.sIgN?r=push', 'https://chalan.pe/quotation/:token?r=push'),
    ('https://chalan.pe/carrier-company/order/abc.def.ghi', 'https://chalan.pe/carrier-company/order/:token'),
    ('https://chalan.pe/carrier-company/orders/abc.def.ghi', 'https://chalan.pe/carrier-company/orders/:token'),
    ('https://chalan.pe/reviews/submit/abc.def.ghi', 'https://chalan.pe/reviews/submit/:token'),
    ('https://chalan.pe/transportistas/documentos/MTI.abc', 'https://chalan.pe/transportistas/documentos/:token'),
    ('https://chalan.pe/v/abc.def', 'https://chalan.pe/v/:token'),
    ('https://chalan.pe/c/2031-5-aB3dE9fG1h', 'https://chalan.pe/c/:token'),
    ('https://chalan.pe/s/108-3-aB3dE9fG1h', 'https://chalan.pe/s/:token'),
    ('https://chalan.pe/r/o2031-aB3dE9fG1h', 'https://chalan.pe/r/:token'),
    ('https://chalan.pe/armado/cotizar/cotizaciones/0123456789abcdef0123456789abcdef',
     'https://chalan.pe/armado/cotizar/cotizaciones/:token'),
    ('https://chalan.pe/login?redirect=%2Facceso%2FWzE0NCwyMV0.aBc', 'https://chalan.pe/login?redirect=%2Facceso%2F:token'),
    ('https://chalan.pe/login?redirect=%2fquotation%2fabc.def', 'https://chalan.pe/login?redirect=%2fquotation%2f:token'),
    ('https://chalan.pe/algo?t=eyJhbGciOi.eyJvcmRlcl9pZCI6.sIgN', 'https://chalan.pe/algo?t=:token'),
])
def test_credentials_are_hidden(url, expected):
    assert _clean(url) == expected


@pytest.mark.parametrize('url', [
    'https://chalan.pe/',
    'https://chalan.pe/?ref=AGT-X7K2&utm_source=google',
    'https://chalan.pe/blog/cuanto-cuesta-un-flete-en-peru',
    'https://chalan.pe/order/step-one',
    'https://chalan.pe/order/2031/step-three?redirect=%2Forder%2F2031%2Fstep-three',
    'https://chalan.pe/order/contacto?redirect=/order/2031/step-three',
    'https://chalan.pe/carrier-company/12',
    'https://chalan.pe/reviews/company/12',
    'https://chalan.pe/transportistas',
    'https://chalan.pe/armado/cotizar/direccion',
])
def test_the_rest_stays_as_is(url):
    assert _clean(url) == url
