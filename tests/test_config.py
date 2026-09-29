import pytest

from app import create_app
from config import CONFIG_ALIASES, ProductionConfig, config


def test_production_is_an_accepted_alias_of_prod():
    # Es como Flask llama al entorno, asi que se tipea solo. Antes daba
    # KeyError y el proceso moria por un sinonimo.
    assert config[CONFIG_ALIASES['production']] is ProductionConfig

    # No se puede levantar una app de produccion aca —no hay DATABASE_URL— pero
    # el tipo de error alcanza: si el alias faltara, esto seria ValueError por
    # nombre invalido y no llegaria nunca a inicializar SQLAlchemy.
    with pytest.raises(RuntimeError) as err:
        create_app('production')

    assert 'SQLALCHEMY_DATABASE_URI' in str(err.value)


def test_prod_never_runs_with_debug_on():
    # Con DEBUG prendido cualquier excepcion le muestra al usuario el traceback
    # y una consola que ejecuta codigo.
    assert ProductionConfig.DEBUG is False


@pytest.mark.parametrize('name', ['produccion', 'PROD', '', None])
def test_an_unknown_config_name_fails_instead_of_falling_back(name):
    # 'default' es DevelopmentConfig: caer ahi por un nombre mal escrito o un
    # FLASK_ENV sin setear arrancaria produccion con DEBUG prendido. No
    # arrancar es el lado seguro del error.
    with pytest.raises(ValueError) as err:
        create_app(name)

    assert 'no es una configuracion valida' in str(err.value)
