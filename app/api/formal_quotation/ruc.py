"""RUC peruano: 11 dígitos, prefijo de tipo de contribuyente y dígito verificador.

Un RUC mal escrito termina en una factura rechazada, así que se revisa aquí y
en vivo en el formulario (`frontend/src/utils/ruc.js`, `backoffice/src/lib/ruc.js`,
la misma cuenta: cambiarlos juntos).
"""
import re

# 10 persona natural con negocio, 15 y 16 no domiciliados y otros, 17
# extranjeros, 20 persona jurídica.
PREFIXES = ('10', '15', '16', '17', '20')
WEIGHTS = (5, 4, 3, 2, 7, 6, 5, 4, 3, 2)


def normalize_ruc(value):
    if not isinstance(value, str):
        return None
    return re.sub(r'\s+', '', value)


def is_valid_ruc(value):
    ruc = normalize_ruc(value)
    if not ruc or not re.fullmatch(r'\d{11}', ruc) or ruc[:2] not in PREFIXES:
        return False
    total = sum(int(digit) * weight for digit, weight in zip(ruc[:10], WEIGHTS))
    check = 11 - total % 11
    if check == 10:
        check = 0
    elif check == 11:
        check = 1
    return check == int(ruc[10])
