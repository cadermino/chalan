from .validation import InvalidRequest, validate_address


def validate_packing_details(details):
    """Packing has no fields of its own yet: the materials live on each item.

    The column exists for services that do (e.g. a cleaning request with a
    number of rooms), so this only checks the shape and drops anything else
    rather than storing what the form was never meant to send.
    """
    if details is not None and not isinstance(details, dict):
        raise InvalidRequest('details must be an object')
    return {}


# assemble: put together a new one or one already moved; disassemble: take it
# apart; both: take it apart at the address and put it together at the
# destination (a move).
FURNITURE_WORKS = ('assemble', 'disassemble', 'both')


def validate_furniture_item(item, index):
    work = item.get('work')
    if work not in FURNITURE_WORKS:
        raise InvalidRequest(f'items[{index}].work must be one of: {", ".join(FURNITURE_WORKS)}')
    pack = item.get('pack', False)
    if not isinstance(pack, bool):
        raise InvalidRequest(f'items[{index}].pack must be true or false')
    return {'work': work, 'pack': pack}


def validate_furniture_details(details):
    """The only field is `destination`, where the `both` items get assembled.

    Same rules as the request's address (picked from Google Places). Whether it
    is needed depends on the items, which can arrive in another PATCH, so that
    is checked on submit.
    """
    if details is None:
        return {}
    if not isinstance(details, dict):
        raise InvalidRequest('details must be an object')
    if details.get('destination') is None:
        return {}
    return {'destination': validate_address(details['destination'], name='details.destination')}


def check_furniture_submit(service_request):
    """A `both` item needs a destination; without one, a stale destination left
    by an item that changed its work is dropped instead of shown to carriers."""
    details = dict(service_request.details or {})
    needs_destination = any(item.work == 'both' for item in service_request.items)
    if needs_destination and not details.get('destination'):
        raise InvalidRequest('details.destination is required when a piece is disassembled and assembled')
    if not needs_destination and 'destination' in details:
        details.pop('destination')
        service_request.details = details


# Painting has no list of things: the customer says what to paint in their own
# words (or in a video, speaking over it), plus a few optional answers that make
# the painters' quotes comparable. Codes, not labels: the labels live in each
# screen (services-web, backoffice).
PAINTING_AREAS = ('interior', 'exterior', 'both')
PAINTING_SIZES = ('detail', 'one_room', 'few_rooms', 'whole')
PAINTING_PAINT_BY = ('customer', 'painter', 'unsure')
PAINTING_WALL_ISSUES = ('humidity', 'cracks', 'putty')
PAINTING_DESCRIPTION_MAX = 2000
PAINTING_M2_MAX = 5000


def _choice(details, key, choices):
    value = details.get(key)
    if value in (None, ''):
        return None
    if value not in choices:
        raise InvalidRequest(f'details.{key} must be one of: {", ".join(choices)}')
    return value


def _described_details(details, max_m2, choices, lists=()):
    """The details of a service told in words instead of a list: an optional
    description, an optional area in m², single choices and multiple choices.
    Every field is optional here: what is required (a description, or a video
    that explains it) is checked on submit, once the media is in."""
    if details is None:
        return {}
    if not isinstance(details, dict):
        raise InvalidRequest('details must be an object')
    cleaned = {}
    description = details.get('description')
    if description is not None:
        if not isinstance(description, str):
            raise InvalidRequest('details.description must be text')
        description = description.strip()
        if len(description) > PAINTING_DESCRIPTION_MAX:
            raise InvalidRequest(f'details.description must be at most {PAINTING_DESCRIPTION_MAX} characters')
        if description:
            cleaned['description'] = description
    for key, options in choices:
        value = _choice(details, key, options)
        if value is not None:
            cleaned[key] = value
    m2 = details.get('area_m2')
    if m2 not in (None, ''):
        if isinstance(m2, bool) or not isinstance(m2, int) or not 1 <= m2 <= max_m2:
            raise InvalidRequest(f'details.area_m2 must be a whole number from 1 to {max_m2}')
        cleaned['area_m2'] = m2
    for key, options in lists:
        values = details.get(key)
        if values not in (None, []):
            if not isinstance(values, list) or any(v not in options for v in values):
                raise InvalidRequest(f'details.{key} must be a list of: {", ".join(options)}')
            cleaned[key] = [v for v in options if v in values]
    return cleaned


def validate_painting_details(details):
    return _described_details(
        details, PAINTING_M2_MAX,
        choices=(('area', PAINTING_AREAS), ('size', PAINTING_SIZES), ('paint_by', PAINTING_PAINT_BY)),
        lists=(('wall_issues', PAINTING_WALL_ISSUES),),
    )


def _check_described(service_request, what):
    """Whoever quotes needs to know the job: written, or told in a video, and
    how many m² (both are quoted per m²; without it the quotes do not compare)."""
    details = service_request.details or {}
    if not details.get('area_m2'):
        raise InvalidRequest('details.area_m2 is required')
    if details.get('description'):
        return
    if any(m.media_type == 'video' for m in service_request.media):
        return
    raise InvalidRequest(f'describe what to {what}, or upload a video explaining it')


def check_painting_submit(service_request):
    _check_described(service_request, 'paint')


# Tile installation (porcelanato y cerámica), code `masonry`: like painting, told
# in words or a video, plus optional answers that move the price per m² (format,
# removing the old floor, levelling). Labels in services-web config.js and the
# backoffice TILING_LABELS.
TILING_MATERIALS = ('porcelain', 'ceramic', 'unsure')
TILING_SURFACES = ('floor', 'wall', 'both')
TILING_ROOMS = ('living', 'bedrooms', 'kitchen', 'bathrooms', 'terrace', 'stairs')
TILING_SIZES = ('60x60', '60x120', 'other')
TILING_REMOVE_OLD = ('yes', 'no')
TILING_SCREED = ('yes', 'no', 'unsure')
TILING_TILES_BY = ('customer', 'installer', 'unsure')
TILING_M2_MAX = 2000


def validate_tiling_details(details):
    return _described_details(
        details, TILING_M2_MAX,
        choices=(('material', TILING_MATERIALS), ('surface', TILING_SURFACES), ('tile_size', TILING_SIZES),
                 ('remove_old', TILING_REMOVE_OLD), ('screed', TILING_SCREED), ('tiles_by', TILING_TILES_BY)),
        lists=(('rooms', TILING_ROOMS),),
    )


def check_tiling_submit(service_request):
    _check_described(service_request, 'install')


# Microcement (application, not the product): like tiles, told in words or a
# video, plus optional answers that move the price per m². What is underneath
# matters most (it goes on top of tiles without demolishing, if they are firm),
# and whether the applicator brings the material (labour only vs all-in).
# Labels in services-web config.js and the backoffice MICROCEMENT_LABELS.
MICROCEMENT_SURFACES = ('floor', 'wall', 'both')
MICROCEMENT_ROOMS = ('bathrooms', 'kitchen', 'living', 'bedrooms', 'countertops', 'stairs', 'terrace', 'facade')
MICROCEMENT_BASES = ('tiles', 'cement', 'plaster', 'unsure')
MICROCEMENT_BASE_ISSUES = ('loose', 'cracks', 'humidity')
MICROCEMENT_MATERIAL_BY = ('customer', 'applicator', 'unsure')
MICROCEMENT_M2_MAX = 2000


def validate_microcement_details(details):
    return _described_details(
        details, MICROCEMENT_M2_MAX,
        choices=(('surface', MICROCEMENT_SURFACES), ('base', MICROCEMENT_BASES),
                 ('material_by', MICROCEMENT_MATERIAL_BY)),
        lists=(('rooms', MICROCEMENT_ROOMS), ('base_issues', MICROCEMENT_BASE_ISSUES)),
    )


def check_microcement_submit(service_request):
    _check_described(service_request, 'apply')


# Code (lu_service_types.code) -> what is specific to that service. A new
# service is a row in lu_service_types plus an entry here; no migration.
#
# - validate_details: the request's `details` JSON.
# - validate_item (optional): the item's own fields; returns them as columns.
# - materials_from (optional): another service's materials catalog. Assembly
#   uses packing's, because the assembler packs with the same materials.
# - check_submit (optional): rules across items and details, before sending.
# - needs_items (default True): whether it is sent with a list of things.
# `form_path` es donde vive el formulario en services-web; la página de
# cotizaciones del cliente cuelga de ahí (`<form_path>/cotizaciones/<public_id>`).
SERVICE_TYPES = {
    'packing': {'validate_details': validate_packing_details, 'form_path': '/embalaje/cotizar'},
    'furniture_assembly': {
        'form_path': '/armado/cotizar',
        'validate_details': validate_furniture_details,
        'validate_item': validate_furniture_item,
        'materials_from': 'packing',
        'check_submit': check_furniture_submit,
    },
    'painting': {
        'form_path': '/pintura/cotizar',
        'validate_details': validate_painting_details,
        'check_submit': check_painting_submit,
        'needs_items': False,
    },
    'masonry': {
        'form_path': '/porcelanato/cotizar',
        'validate_details': validate_tiling_details,
        'check_submit': check_tiling_submit,
        'needs_items': False,
    },
    'microcement': {
        'form_path': '/microcemento/cotizar',
        'validate_details': validate_microcement_details,
        'check_submit': check_microcement_submit,
        'needs_items': False,
    },
}


def needs_items(service_type):
    return SERVICE_TYPES[service_type.code].get('needs_items', True)
