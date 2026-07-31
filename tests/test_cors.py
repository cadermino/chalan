import os

import pytest

from app import _parse_cors_origins


@pytest.fixture(autouse=True)
def _clear_cors_env():
    original = os.environ.pop('CORS', None)
    yield
    if original is not None:
        os.environ['CORS'] = original
    else:
        os.environ.pop('CORS', None)


def test_parses_python_list_literal_into_a_real_list():
    os.environ['CORS'] = '[r"http://localhost:*", "http://local.chalan.mx:*", "http://local.chalan.mx"]'
    origins = _parse_cors_origins()
    assert origins == ['http://localhost:*', 'http://local.chalan.mx:*', 'http://local.chalan.mx']


def test_parses_single_origin_list():
    os.environ['CORS'] = '[r"https://chalan.pe"]'
    assert _parse_cors_origins() == ['https://chalan.pe']


def test_missing_env_var_returns_none_and_falls_back_to_flask_cors_default():
    assert 'CORS' not in os.environ
    assert _parse_cors_origins() is None


def test_malformed_value_falls_back_to_raw_string_instead_of_crashing():
    os.environ['CORS'] = 'not a python literal ['
    assert _parse_cors_origins() == 'not a python literal ['
