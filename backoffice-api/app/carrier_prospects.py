"""Transportistas de Google Maps para las órdenes que no son de Lima.

Hoy los transportistas dados de alta son de Lima. Para una orden de provincia, el
admin ve aquí los negocios de transporte de esa zona que sacó Apify (repo
automajob-contacts, ver scripts/build_carrier_prospects.py), filtrados por lo que
la orden pide transportar. Son contactos en frío: no están en la plataforma.

Todo lo de este módulo son funciones puras sobre `app/resources/carrier_prospects.json`,
así se prueban sin base de datos.
"""
import functools
import json
import math
import pathlib
import re
import unicodedata

RESOURCE = pathlib.Path(__file__).parent / 'resources' / 'carrier_prospects.json'

# Lima y Callao son un solo mercado: ahí ya hay transportistas en la plataforma.
LIMA_CODES = {'15', '07'}

# Los dos primeros dígitos del código postal peruano (que coinciden con el ubigeo).
DEPARTMENTS = {
    '01': 'Amazonas', '02': 'Áncash', '03': 'Apurímac', '04': 'Arequipa', '05': 'Ayacucho',
    '06': 'Cajamarca', '07': 'Callao', '08': 'Cusco', '09': 'Huancavelica', '10': 'Huánuco',
    '11': 'Ica', '12': 'Junín', '13': 'La Libertad', '14': 'Lambayeque', '15': 'Lima',
    '16': 'Loreto', '17': 'Madre de Dios', '18': 'Moquegua', '19': 'Pasco', '20': 'Piura',
    '21': 'Puno', '22': 'San Martín', '23': 'Tacna', '24': 'Tumbes', '25': 'Ucayali',
}

# Dónde puede trabajar una empresa (carrier_company_departments): Callao va dentro
# de Lima, que es un solo mercado, así que no se elige aparte.
WORK_DEPARTMENTS = {
    code: 'Lima y Callao' if code == '15' else name
    for code, name in DEPARTMENTS.items() if code != '07'
}

# Cómo aparece cada departamento en el texto de una dirección: su nombre y las
# ciudades que Google escribe en lugar del departamento. Sin tildes y en minúsculas.
_ALIASES = {
    '01': ['amazonas', 'chachapoyas'], '02': ['ancash', 'huaraz', 'chimbote'],
    '03': ['apurimac', 'abancay'], '04': ['arequipa'], '05': ['ayacucho'],
    '06': ['cajamarca'], '07': ['callao'], '08': ['cusco', 'cuzco'],
    '09': ['huancavelica'], '10': ['huanuco'], '11': ['ica'], '12': ['junin', 'huancayo'],
    '13': ['la libertad', 'trujillo'], '14': ['lambayeque', 'chiclayo'],
    '15': ['lima', 'miraflores', 'san isidro', 'surco', 'la molina', 'san borja', 'jesus maria',
           'lince', 'barranco', 'magdalena', 'pueblo libre', 'san miguel', 'chorrillos',
           'villa el salvador', 'villa maria del triunfo', 'san juan de miraflores', 'ate',
           'los olivos', 'comas', 'san juan de lurigancho', 'san martin de porres',
           'la victoria', 'brena', 'rimac', 'independencia', 'surquillo', 'san luis',
           'santa anita', 'el agustino', 'lurin', 'carabayllo', 'puente piedra', 'chaclacayo',
           'lurigancho', 'cieneguilla', 'pachacamac', 'ancon', 'santiago de surco'],
    '16': ['loreto', 'iquitos'], '17': ['madre de dios', 'puerto maldonado'],
    '18': ['moquegua'], '19': ['pasco', 'cerro de pasco'], '20': ['piura'],
    '21': ['puno', 'juliaca'], '22': ['san martin', 'tarapoto', 'moyobamba'],
    '23': ['tacna'], '24': ['tumbes'], '25': ['ucayali', 'pucallpa'],
}
_ALIAS_RE = [
    (code, re.compile(r'\b(?:' + '|'.join(re.escape(a) for a in aliases) + r')\b'))
    for code, aliases in _ALIASES.items()
]

# Qué puede pedir una orden. El orden es la prioridad cuando detecta varios.
NEEDS = [
    ('vehiculos', 'Vehículos (camioneta, moto, auto)'),
    ('construccion', 'Material de construcción'),
    ('carga', 'Carga y fletes'),
    ('mudanza', 'Mudanza'),
]
NEED_LABELS = dict(NEEDS)

# Palabras del pedido del cliente (el campo `comments` de la orden).
_NEED_WORDS = {
    'vehiculos': r'camioneta|pick ?up|moto|motos|motocicleta|motocicletas|mototaxi|cuatrimoto|auto|autos|'
                 r'carro|carros|automovil|automoviles|vehiculo|vehiculos|suv',
    'construccion': r'material(?:es)? de construccion|cemento|ladrillos?|fierros?|varillas?|arena|piedra|'
                    r'agregados|calamina|drywall|tuberias?|mayolicas?|ceramicos?|porcelanato|madera|'
                    r'triplay|vigas?|andamios?|volquete|mezcladora',
    'carga': r'flete|carga|mercaderia|pallets?|paletas?|maquinaria|equipos? industriales?',
}
_NEED_RE = {need: re.compile(r'\b(?:' + words + r')\b') for need, words in _NEED_WORDS.items()}

# Tipo que `leads.py` le puso a cada negocio (por su nombre y categoría de Google).
_EXACT_TYPE = {'vehiculos': 'vehiculos', 'construccion': 'carga', 'carga': 'carga', 'mudanza': 'mudanza'}
_RELATED_TYPE = {'vehiculos': (), 'construccion': (), 'carga': ('mudanza',), 'mudanza': ('carga',)}
# Y palabras de su nombre o categoría que delatan que sirve aunque su tipo sea otro.
_HINTS = {
    'vehiculos': ('grua', 'plataforma', 'cama baja', 'remolque', 'vehiculo', 'camioneta', 'moto', 'auto'),
    'construccion': ('volquete', 'material', 'construccion', 'cemento', 'agregado', 'ladrillo'),
    'carga': ('flete', 'carga', 'camion'),
    'mudanza': ('mudanza',),
}

MAX_RESULTS = 40


def normalize(text):
    text = unicodedata.normalize('NFKD', str(text or '')).encode('ascii', 'ignore').decode()
    return re.sub(r'\s+', ' ', text.lower()).strip()


@functools.lru_cache(maxsize=1)
def load_prospects():
    if not RESOURCE.exists():
        return ()
    return tuple(json.loads(RESOURCE.read_text(encoding='utf-8')).get('prospects', []))


def haversine_km(lat1, lng1, lat2, lng2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = (math.sin((p2 - p1) / 2) ** 2
         + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2)
    return 6371 * 2 * math.asin(math.sqrt(a))


def _postal_department(zip_code, street):
    """El departamento que dice el código postal, o None.

    El código viene en `zip_code` o, si no, al final de la dirección que arma
    Google ("Calle X 123, Arequipa 04003, Perú"). No se busca cualquier número
    de cinco dígitos: una numeración de calle también los tiene.
    """
    candidates = []
    if zip_code and re.fullmatch(r'\d{5}', str(zip_code).strip()):
        candidates.append(str(zip_code).strip())
    match = re.search(r'\s(\d{5})\s*(?:,\s*per[uú])?\s*$', str(street or ''), re.IGNORECASE)
    if match:
        candidates.append(match.group(1))
    for code in candidates:
        if code[:2] in DEPARTMENTS:
            return code[:2]
    return None


def _text_department(*texts):
    """El departamento que se nombra en el texto, o None.

    Gana el último que aparece: Google escribe la dirección de lo particular a
    lo general ("Av. Arequipa 2450, Miraflores, Perú"), y "Arequipa" o "Lima"
    también son nombres de calle.
    """
    haystack = normalize(' '.join(t for t in texts if t))
    best, best_end = None, -1
    for code, pattern in _ALIAS_RE:
        for found in pattern.finditer(haystack):
            if found.end() > best_end:
                best, best_end = code, found.end()
    return best


def locate(address):
    """Dónde queda una dirección de la orden: departamento y coordenadas si las hay.

    `address` es un OrderDetail (o cualquier cosa con street, zip_code, city,
    state, latitude y longitude). Devuelve None si no se puede saber.
    El departamento sale del código postal; si no hay, de la ciudad y el estado
    que guardó el formulario; y si no, del texto de la dirección. Las órdenes
    anteriores a guardar ciudad y coordenadas solo tienen la dirección escrita.
    """
    if address is None:
        return None
    source = 'postal'
    code = _postal_department(getattr(address, 'zip_code', None), getattr(address, 'street', None))
    if code is None:
        source = 'text'
        code = (_text_department(getattr(address, 'city', None), getattr(address, 'state', None))
                or _text_department(getattr(address, 'street', None)))
    if code is None:
        return None
    lat, lng = getattr(address, 'latitude', None), getattr(address, 'longitude', None)
    has_coords = lat is not None and lng is not None
    return {
        'code': code,
        'department': DEPARTMENTS[code],
        'lima': code in LIMA_CODES,
        'source': source,
        'lat': float(lat) if has_coords else None,
        'lng': float(lng) if has_coords else None,
    }


def detect_needs(text):
    """Qué pide la orden, según lo que escribió el cliente. Siempre devuelve algo:
    sin pistas es una mudanza, que es lo que casi todas son."""
    haystack = normalize(text)
    found = [need for need, _ in NEEDS if need in _NEED_RE and _NEED_RE[need].search(haystack)]
    return found or ['mudanza']


def _match_level(prospect, need):
    """0 si el negocio es exactamente de ese tipo, 1 si sirve de apoyo, None si no."""
    if need == 'todos':
        return 0
    if prospect.get('type') == _EXACT_TYPE[need]:
        return 0
    if prospect.get('type') in _RELATED_TYPE[need]:
        return 1
    text = normalize(f"{prospect.get('name', '')} {prospect.get('category', '')}")
    if any(hint in text for hint in _HINTS[need]):
        return 1
    return None


def match(location, need, prospects=None, limit=MAX_RESULTS):
    """Transportistas del departamento de `location` para esa necesidad.

    Salen primero los de tipo exacto. Dentro de cada grupo, por cercanía si la
    orden y el negocio tienen coordenadas, y si no, por la puntuación que
    calculó automajob (rating ponderado por reseñas).
    """
    prospects = load_prospects() if prospects is None else prospects
    here = (location['lat'], location['lng']) if location.get('lat') is not None else None
    rows = []
    for p in prospects:
        if p.get('department') != location['code']:
            continue
        level = _match_level(p, need)
        if level is None:
            continue
        distance = None
        if here and p.get('lat') is not None:
            distance = round(haversine_km(here[0], here[1], p['lat'], p['lng']), 1)
        rows.append((level, p, distance))

    # Con coordenadas manda la distancia; sin ellas, la puntuación.
    if here:
        rows.sort(key=lambda r: (r[0], r[2] if r[2] is not None else 1e9, -(r[1].get('score') or 0)))
    else:
        rows.sort(key=lambda r: (r[0], -(r[1].get('score') or 0), -(r[1].get('reviews') or 0)))
    return [
        {
            'id': p['id'], 'name': p['name'], 'city': p.get('city'), 'type': p.get('type') or None,
            'category': p.get('category'), 'address': p.get('address'), 'rating': p.get('rating'),
            'reviews': p.get('reviews'), 'phone': p.get('phone'), 'maps_url': p.get('maps_url'),
            'distance_km': distance, 'exact': level == 0,
        }
        for level, p, distance in rows[:limit]
    ]


def count_by_need(location, prospects=None):
    """Cuántos negocios hay para cada necesidad (los chips de la pantalla)."""
    prospects = load_prospects() if prospects is None else prospects
    counts = {'todos': 0}
    for need, _ in NEEDS:
        counts[need] = 0
    for p in prospects:
        if p.get('department') != location['code']:
            continue
        counts['todos'] += 1
        for need, _ in NEEDS:
            if _match_level(p, need) is not None:
                counts[need] += 1
    return counts
