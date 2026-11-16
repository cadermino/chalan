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


# Cómo se lee cada valor (el historial de cambios, api/order/versions.py). Los
# mismos textos que frontend/src/utils/loadTypes.js.
LOAD_TYPE_LABELS = {
    'moving': 'Mudanza',
    'items': 'Objetos sueltos',
    'cargo': 'Carga o materiales',
    'vehicle': 'Vehículo',
}
CARGO_WEIGHT_LABELS = {
    500: 'Hasta 500 kg',
    1500: 'Hasta 1,5 toneladas',
    3000: 'Hasta 3 toneladas',
    10000: 'Hasta 10 toneladas',
    20000: 'Más de 10 toneladas',
}


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
