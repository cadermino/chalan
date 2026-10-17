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


# Code (lu_service_types.code) -> what is specific to that service. A new
# service is a row in lu_service_types plus an entry here; no migration.
#
# - validate_details: the request's `details` JSON.
# - validate_item (optional): the item's own fields; returns them as columns.
# - materials_from (optional): another service's materials catalog. Assembly
#   uses packing's, because the assembler packs with the same materials.
# - check_submit (optional): rules across items and details, before sending.
SERVICE_TYPES = {
    'packing': {'validate_details': validate_packing_details},
    'furniture_assembly': {
        'validate_details': validate_furniture_details,
        'validate_item': validate_furniture_item,
        'materials_from': 'packing',
        'check_submit': check_furniture_submit,
    },
}
