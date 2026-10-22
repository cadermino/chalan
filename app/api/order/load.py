"""Qué lleva una orden (migración 030).

Una de cada cuatro órdenes que entraban por el formulario de mudanza era carga:
sacos de arroz, cemento, geomembrana, una camioneta. El cliente lo elige en el
paso 1 (o en el widget de la web) y el transportista lo ve antes de cotizar.
Las mismas listas viven en el front: frontend/src/utils/loadTypes.js.
"""

LOAD_TYPES = ('moving', 'items', 'cargo', 'vehicle')

# Topes de los tramos de peso, en kg: hasta 500 kg, 1,5 t, 3 t, 10 t, y más
# de 10 t (guardado como 20000). Tramos y no un número libre por lo mismo que
# el estacionamiento: nadie sabe cuántos kilos lleva, pero sí si son unos
# sacos o un camión lleno.
CARGO_WEIGHTS = (500, 1500, 3000, 10000, 20000)


def clean_load_type(value):
    return value if value in LOAD_TYPES else None


def clean_cargo_weight(value):
    try:
        weight = int(value)
    except (TypeError, ValueError):
        return None
    return weight if weight in CARGO_WEIGHTS else None


def needs_cargo_weight(load_type):
    return load_type == 'cargo'
