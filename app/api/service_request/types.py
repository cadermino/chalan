from .validation import InvalidRequest


def validate_packing_details(details):
    """Packing has no fields of its own yet: the materials live on each item.

    The column exists for services that do (e.g. a cleaning request with a
    number of rooms), so this only checks the shape and drops anything else
    rather than storing what the form was never meant to send.
    """
    if details is not None and not isinstance(details, dict):
        raise InvalidRequest('details must be an object')
    return {}


# Code (lu_service_types.code) -> what is specific to that service. A new
# service is a row in lu_service_types plus an entry here; no migration.
SERVICE_TYPES = {
    'packing': {'validate_details': validate_packing_details},
}
