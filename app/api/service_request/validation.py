from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from ...models import ServiceMaterial

LIMA = ZoneInfo('America/Lima')

MAX_ITEMS = 50
MAX_MEDIA = 10
MAX_ADVANCE_DAYS = 90
IMAGE_MAX_BYTES = 10 * 1024 * 1024
VIDEO_MAX_BYTES = 100 * 1024 * 1024

# content type -> (media type, file extension). media_type is derived from the
# content type here and never taken from the client.
MEDIA_TYPES = {
    'image/jpeg': ('image', 'jpg'),
    'image/png': ('image', 'png'),
    'image/webp': ('image', 'webp'),
    'image/heic': ('image', 'heic'),
    'image/heif': ('image', 'heif'),
    'video/mp4': ('video', 'mp4'),
    'video/quicktime': ('video', 'mov'),
    'video/webm': ('video', 'webm'),
}
MEDIA_MAX_BYTES = {'image': IMAGE_MAX_BYTES, 'video': VIDEO_MAX_BYTES}

# column -> (max length, required)
ADDRESS_FIELDS = {
    'street': (200, True),
    'interior': (100, False),
    'neighborhood': (100, False),
    'city': (100, False),
    'state': (100, False),
    'country': (20, True),
    'map_url': (400, True),
}


class InvalidRequest(Exception):
    """A request the client got wrong; the route turns it into a 400."""


def now_lima():
    return datetime.now(LIMA)


def today_lima():
    # "Today" is the customer's, not the server's: after 7 p.m. in Lima it is
    # already tomorrow in UTC, and a UTC date would reject a valid day.
    return now_lima().date()


def validate_address(address):
    """Requires street, country and map_url: map_url is the proof that the user
    picked a Google Places suggestion instead of typing free text, which is what
    carrier pricing needs. Same rule as the move flow; do not relax it."""
    if not isinstance(address, dict):
        raise InvalidRequest('address is required')
    cleaned = {}
    for field, (max_length, required) in ADDRESS_FIELDS.items():
        value = address.get(field)
        if value is not None and not isinstance(value, str):
            raise InvalidRequest(f'address.{field} must be a string')
        value = (value or '').strip()
        if not value:
            if required:
                raise InvalidRequest(f'address.{field} is required')
            cleaned[field] = None
            continue
        if len(value) > max_length:
            raise InvalidRequest(f'address.{field} is too long (max {max_length})')
        cleaned[field] = value
    return cleaned


def validate_preferred_date(value, allow_today=False):
    """Fecha del servicio. El cliente pide desde mañana; un admin que anota un pedido
    urgente que llegó por WhatsApp puede pedirlo para hoy (allow_today)."""
    if not isinstance(value, str):
        raise InvalidRequest('preferred_date must be a YYYY-MM-DD date')
    try:
        parsed = datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError:
        raise InvalidRequest('preferred_date must be a YYYY-MM-DD date')
    today = today_lima()
    earliest = today if allow_today else today + timedelta(days=1)
    if parsed < earliest:
        raise InvalidRequest('preferred_date must be from today on' if allow_today
                             else 'preferred_date must be from tomorrow on')
    if parsed > today + timedelta(days=MAX_ADVANCE_DAYS):
        raise InvalidRequest(f'preferred_date must be within {MAX_ADVANCE_DAYS} days')
    return parsed


def validate_items(items, service_type_id):
    """Returns [{'description', 'quantity', 'materials': [ServiceMaterial]}].

    Materials come from the catalog by code: they must exist, be active and
    belong to the request's service type. An empty list is valid and means
    "let the carrier recommend".
    """
    if not isinstance(items, list):
        raise InvalidRequest('items must be a list')
    if len(items) > MAX_ITEMS:
        raise InvalidRequest(f'at most {MAX_ITEMS} items are allowed')

    catalog = {
        m.code: m for m in ServiceMaterial.query.filter_by(
            service_type_id=service_type_id, active=1)
    }
    cleaned = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise InvalidRequest(f'items[{index}] must be an object')
        description = item.get('description')
        if not isinstance(description, str) or not description.strip():
            raise InvalidRequest(f'items[{index}].description is required')
        description = description.strip()
        if len(description) > 200:
            raise InvalidRequest(f'items[{index}].description is too long (max 200)')
        quantity = item.get('quantity', 1)
        if isinstance(quantity, bool) or not isinstance(quantity, int) or not 1 <= quantity <= 999:
            raise InvalidRequest(f'items[{index}].quantity must be an integer between 1 and 999')
        codes = item.get('materials', [])
        if not isinstance(codes, list) or not all(isinstance(c, str) for c in codes):
            raise InvalidRequest(f'items[{index}].materials must be a list of codes')
        materials = []
        for code in dict.fromkeys(codes):
            if code not in catalog:
                raise InvalidRequest(f'unknown material: {code}')
            materials.append(catalog[code])
        cleaned.append({'description': description, 'quantity': quantity, 'materials': materials})
    return cleaned


def validate_media_upload(content_type, size_bytes):
    """Checks a file the browser announces it will upload. Returns (media_type, extension)."""
    if content_type not in MEDIA_TYPES:
        raise InvalidRequest('file type not allowed')
    media_type, extension = MEDIA_TYPES[content_type]
    if isinstance(size_bytes, bool) or not isinstance(size_bytes, int) or size_bytes < 1:
        raise InvalidRequest('size_bytes must be a positive integer')
    if size_bytes > MEDIA_MAX_BYTES[media_type]:
        limit_mb = MEDIA_MAX_BYTES[media_type] // (1024 * 1024)
        raise InvalidRequest(f'{media_type} too large (max {limit_mb}MB)')
    return media_type, extension
