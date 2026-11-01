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
