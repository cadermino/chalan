"""Direcciones que salen de Chalán hacia las empresas: solo el distrito hasta
que el trabajo es de ellas (servicios y mudanzas)."""
import re
import unicodedata

_NOT_A_DISTRICT = re.compile(r'^(per[uú]|lima|callao|provincia de lima)$', re.IGNORECASE)
_POSTAL_CODE = re.compile(r'\b\d{5}\b')

# Los distritos de Lima y Callao: el primer tramo de la dirección es la calle,
# salvo cuando el cliente eligió el distrito mismo ("Los Olivos, Lima 15063").
# Sin tildes y en minúsculas, como los compara `_plain`.
_LIMA_DISTRICTS = frozenset((
    'cercado de lima', 'lince', 'jesus maria', 'pueblo libre', 'magdalena', 'magdalena del mar', 'san miguel',
    'san isidro', 'miraflores', 'barranco', 'surquillo', 'san borja', 'surco', 'santiago de surco', 'la molina',
    'ate', 'santa anita', 'el agustino', 'la victoria', 'brena', 'rimac', 'san martin de porres', 'los olivos',
    'independencia', 'comas', 'carabayllo', 'puente piedra', 'ancon', 'santa rosa', 'san juan de lurigancho',
    'lurigancho', 'chaclacayo', 'cieneguilla', 'san juan de miraflores', 'villa maria del triunfo',
    'villa el salvador', 'chorrillos', 'san luis', 'pachacamac', 'lurin', 'punta hermosa', 'punta negra',
    'san bartolo', 'pucusana', 'bellavista', 'la perla', 'carmen de la legua', 'carmen de la legua reynoso',
    'ventanilla', 'la punta', 'mi peru',
))


def _plain(text):
    text = unicodedata.normalize('NFD', text.lower())
    return ''.join(c for c in text if unicodedata.category(c) != 'Mn')


def district_of(address):
    """El distrito de una dirección. Primero el tramo del texto de Google con el
    código postal ("Calle 123, Barranco 15063"): `neighborhood` puede traer la
    urbanización ("Fund Oyague" en Jesús María), que el formulario de servicios
    guardaba antes que el distrito. Si no está, `neighborhood` (el que escribe un
    admin), otro tramo con nombre o la ciudad. "Lima" o "Callao" solo si no hay
    nada más: Google también escribe "Calle 123, Los Olivos, Lima 15301", con la
    provincia junto al código postal. El primer tramo (la calle) solo cuenta si
    es un distrito. Mismo criterio que
    backoffice/src/lib/district.js y app/api/address.py."""
    first, *parts = [p.strip() for p in (address.get('street') or '').split(',') if p.strip()] or ['']
    with_zip = next((p for p in parts if _POSTAL_CODE.search(p)), None)
    from_zip = _POSTAL_CODE.sub('', with_zip).strip() if with_zip else ''
    named = next((p for p in reversed(parts) if not _NOT_A_DISTRICT.match(p) and not re.search(r'\d', p)), None)
    picked = first if _plain(first) in _LIMA_DISTRICTS else None
    found = [from_zip, address.get('neighborhood'), named, picked, address.get('city')]
    return next((d for d in found if d and not _NOT_A_DISTRICT.match(d)), None) or next((d for d in found if d), None)
