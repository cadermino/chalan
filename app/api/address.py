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
    admin), otro tramo con nombre o la ciudad. "Lima" o "Callao" solo si no hay
    nada más: Google también escribe "Calle 123, Los Olivos, Lima 15301", con la
    provincia junto al código postal. Mismo criterio que
    backoffice/src/lib/district.js y backoffice-api/app/address.py."""
    parts = [p.strip() for p in (address.get('street') or '').split(',') if p.strip()][1:]
    with_zip = next((p for p in parts if _POSTAL_CODE.search(p)), None)
    from_zip = _POSTAL_CODE.sub('', with_zip).strip() if with_zip else ''
    named = next((p for p in reversed(parts) if not _NOT_A_DISTRICT.match(p) and not re.search(r'\d', p)), None)
    found = [from_zip, address.get('neighborhood'), named, address.get('city')]
    return next((d for d in found if d and not _NOT_A_DISTRICT.match(d)), None) or next((d for d in found if d), None)
