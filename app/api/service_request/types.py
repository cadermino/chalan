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


def validate_painting_details(details):
    """Every field is optional here: what is required (a description, or a
    video that explains it) is checked on submit, once the media is in."""
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
    for key, choices in (('area', PAINTING_AREAS), ('size', PAINTING_SIZES), ('paint_by', PAINTING_PAINT_BY)):
        value = _choice(details, key, choices)
        if value is not None:
            cleaned[key] = value
    m2 = details.get('area_m2')
    if m2 not in (None, ''):
        if isinstance(m2, bool) or not isinstance(m2, int) or not 1 <= m2 <= PAINTING_M2_MAX:
            raise InvalidRequest(f'details.area_m2 must be a whole number from 1 to {PAINTING_M2_MAX}')
        cleaned['area_m2'] = m2
    issues = details.get('wall_issues')
    if issues not in (None, []):
        if not isinstance(issues, list) or any(i not in PAINTING_WALL_ISSUES for i in issues):
            raise InvalidRequest(f'details.wall_issues must be a list of: {", ".join(PAINTING_WALL_ISSUES)}')
        cleaned['wall_issues'] = [i for i in PAINTING_WALL_ISSUES if i in issues]
    return cleaned


def check_painting_submit(service_request):
    """The painter needs to know what to paint: written, or told in a video."""
    if (service_request.details or {}).get('description'):
        return
    if any(m.media_type == 'video' for m in service_request.media):
        return
    raise InvalidRequest('describe what to paint, or upload a video explaining it')


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
}


def needs_items(service_type):
    return SERVICE_TYPES[service_type.code].get('needs_items', True)
