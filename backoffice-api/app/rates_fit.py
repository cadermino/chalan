"""Las tarifas que mejor reproducen lo que una empresa ya cotizó.

Casi ninguna empresa sabe decir su precio por m³: sabe cuánto cobra una mudanza
cuando la ve. Con sus cotizaciones pasadas y la mudanza de cada una (los
`inputs` de `auto_quote_estimates`) se ajustan la base y los precios por m³,
por cargador y por piso de la fórmula (`rates_formula.py`) por mínimos
cuadrados, sin tarifas negativas.

Después se suben lo justo para que casi nunca queden muy por debajo de lo que
cotizó: cotizar de menos ata a la empresa a un precio que no habría dado, y
cotizar de más solo pierde esa orden. En 232 cotizaciones de producción
(noviembre de 2026) el ajuste sin subir quedaba más de 25% abajo en 1 de cada 7.
"""
from itertools import combinations

from .rates_formula import estimate

FIELDS = ('base_fee', 'per_m3', 'per_loader', 'per_floor')
_INPUTS = (None, 'm3', 'loaders', 'floors')
# A cuánto se redondea cada tarifa: nadie cobra S/ 13.47 por m³.
_STEPS = {'base_fee': 10, 'per_m3': 1, 'per_loader': 5, 'per_floor': 5}
MIN_QUOTATIONS = 10
MAX_RAISE = 0.30


def _solve(matrix, vector):
    """Eliminación de Gauss con pivote. None si el sistema no tiene una solución
    (todas las mudanzas con los mismos cargadores, por ejemplo)."""
    n = len(vector)
    rows = [list(matrix[i]) + [vector[i]] for i in range(n)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(rows[r][col]))
        if abs(rows[pivot][col]) < 1e-9:
            return None
        rows[col], rows[pivot] = rows[pivot], rows[col]
        for r in range(n):
            if r != col:
                factor = rows[r][col] / rows[col][col]
                rows[r] = [a - factor * b for a, b in zip(rows[r], rows[col])]
    return [rows[i][n] / rows[i][i] for i in range(n)]


def _least_squares(xs, ys):
    """Los cuatro coeficientes, >= 0. Se prueba cada grupo de variables (siempre
    con la base) y gana el que menos se equivoca sin dar una tarifa negativa."""
    best, best_error = None, None
    for size in range(len(_INPUTS), 0, -1):
        for cols in combinations(range(len(_INPUTS)), size):
            if 0 not in cols:
                continue
            matrix = [[sum(x[a] * x[b] for x in xs) for b in cols] for a in cols]
            solution = _solve(matrix, [sum(x[a] * y for x, y in zip(xs, ys)) for a in cols])
            if solution is None or min(solution) < 0:
                continue
            coefficients = [0.0] * len(_INPUTS)
            for col, value in zip(cols, solution):
                coefficients[col] = value
            error = sum((sum(c * v for c, v in zip(coefficients, x)) - y) ** 2 for x, y in zip(xs, ys))
            if best_error is None or error < best_error:
                best, best_error = coefficients, error
    return best


def _rounded(coefficients, raise_by):
    return {field: round(value * (1 + raise_by) / _STEPS[field]) * _STEPS[field]
            for field, value in zip(FIELDS, coefficients)}


def suggest(moves, low, max_low_share, weekend_percent=0):
    """Las tarifas sugeridas ({campo: soles}) o None si hay pocas cotizaciones.

    `moves` es [(inputs, lo que cotizó)]. `low` y `max_low_share` son la regla
    de "muy por debajo": se sube todo de a 1% (hasta MAX_RAISE) hasta que a lo
    más esa parte de las cotizaciones quede más de `low` por encima de lo
    calculado. El recargo de fin de semana que la empresa ya tiene se descuenta
    antes de ajustar, porque la fórmula lo vuelve a poner.
    """
    moves = [(inputs, float(quoted)) for inputs, quoted in moves if quoted]
    if len(moves) < MIN_QUOTATIONS:
        return None
    weekend = 1 + float(weekend_percent or 0) / 100
    xs = [[1.0] + [float(inputs.get(key) or 0) for key in _INPUTS[1:]] for inputs, _ in moves]
    ys = [quoted / weekend if inputs.get('weekend') else quoted for inputs, quoted in moves]
    coefficients = _least_squares(xs, ys)
    if coefficients is None:
        return None

    rates = _rounded(coefficients, 0)
    for percent in range(0, int(MAX_RAISE * 100) + 1):
        rates = _rounded(coefficients, percent / 100)
        totals = [estimate(rates, m3=x[1], loaders=int(x[2]), floors=int(x[3]))['total'] for x in xs]
        too_low = sum(1 for total, y in zip(totals, ys) if total < y * (1 - low))
        if too_low <= max_low_share * len(ys):
            break
    return rates
