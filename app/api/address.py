"""Direcciones que salen de Chalán hacia las empresas: solo el distrito hasta
que el trabajo es de ellas (servicios y mudanzas)."""
import re

_NOT_A_DISTRICT = re.compile(r'^(per[uú]|lima|callao|provincia de lima)$', re.IGNORECASE)
_POSTAL_CODE = re.compile(r'\b\d{5}\b')


def district_of(address):
    """El distrito de una dirección. Primero el tramo del texto de Google con el
    código postal ("Calle 123, Barranco 15063"): `neighborhood` puede traer la
    urbanización ("Fund Oyague" en Jesús María), que el formulario de servicios
    guardaba antes que el distrito. Si no está, `neighborhood` (el que escribe un
    admin), otro tramo con nombre o la ciudad. Mismo criterio que
    backoffice/src/lib/district.js y backoffice-api/app/address.py."""
    parts = [p.strip() for p in (address.get('street') or '').split(',') if p.strip()][1:]
    with_zip = next((p for p in parts if _POSTAL_CODE.search(p)), None)
    if with_zip and _POSTAL_CODE.sub('', with_zip).strip():
        return _POSTAL_CODE.sub('', with_zip).strip()
    if address.get('neighborhood'):
        return address['neighborhood']
    named = next((p for p in reversed(parts) if not _NOT_A_DISTRICT.match(p) and not re.search(r'\d', p)), None)
    return named or address.get('city')


# Lo que identifica la puerta dentro de la calle: el número ("1234", "N° 1234",
# "#1234", "1234-B"), el lote ("Lt. 5") y el interior ("Dpto 401", "Int. 2").
_UNIT = re.compile(r'\b(?:dpto|depto|dep|departamento|int|interior|of|oficina|piso)\.?\s*[\w-]+', re.IGNORECASE)
_LOT = re.compile(r'\b(?:lt|lote)\.?\s*\w+', re.IGNORECASE)
_STREET_TYPE_ONLY = re.compile(r'^(?:av|avenida|calle|ca|jr|jir[oó]n|psje|pje|pasaje|prol|prolongaci[oó]n)\.?$', re.IGNORECASE)
_HOUSE_NUMBER = re.compile(r'\s*(?:\b(?:n(?:ro)?|no)\.?\s*[°º]?|[°º#])?\s*\d+[a-z]?(?:\s*-\s*\w+)?\s*$', re.IGNORECASE)


def street_without_number(address):
    """La calle sin el número de la puerta: "Av. Arequipa 1234, Lince 15046,
    Perú" da "Av. Arequipa". Es lo que ve una empresa de un servicio hasta que la
    eligen: con la calle y el distrito cotiza (el distrito de Google no siempre
    sale bien), y sin el número no puede ir a buscar al cliente por fuera. Solo
    el primer tramo del texto de Google, que es la calle; el distrito va aparte
    (district_of). Mismo criterio que backoffice-api/app/address.py."""
    street = next((p.strip() for p in (address.get('street') or '').split(',') if p.strip()), '')
    street = re.sub(r'\s{2,}', ' ', _LOT.sub('', _UNIT.sub('', street))).strip(' ,-')
    # "Pasaje 7", "Calle 12": ese número es el nombre de la calle.
    without = _HOUSE_NUMBER.sub('', street).strip(' ,-')
    return (street if _STREET_TYPE_ONLY.match(without) else without) or None
