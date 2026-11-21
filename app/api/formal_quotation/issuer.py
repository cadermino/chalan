"""Quién emite la cotización formal y a dónde se paga.

Los datos de la empresa (razón social, RUC, dirección, contacto) son públicos en
SUNAT y en la web, y van aquí. Los de pago y el nombre de quien firma vienen del
entorno (`.env.prod` en el servidor, `.env.dev` en local): el repo es público y
la cuenta es personal (Chalán todavía no tiene cuenta propia, noviembre de
2026; el cliente le paga todo a esa cuenta y de ahí se le paga al
transportista). Sin cuenta configurada, el PDF pide los datos por correo en vez
de mostrar una cuenta vacía.

- `FORMAL_QUOTATION_BANK_HOLDER`: titular de la cuenta.
- `FORMAL_QUOTATION_BANK_NAME`: banco y tipo (por defecto "BCP – Cuenta de ahorros en soles").
- `FORMAL_QUOTATION_BANK_ACCOUNT`, `FORMAL_QUOTATION_BANK_CCI`.
- `FORMAL_QUOTATION_YAPE`: número de Yape (opcional).
- `FORMAL_QUOTATION_SIGNER`: quién firma (por defecto, la razón social).
"""
import os

COMPANY_NAME = 'Chalán Soluciones E.I.R.L.'
COMPANY_NAME_UPPER = 'CHALÁN SOLUCIONES E.I.R.L.'
COMPANY_RUC = '20616033094'
COMPANY_ADDRESS = 'Pasaje Los Arenales 285, Pío Pata, El Tambo, Huancayo, Junín'
WEBSITE = 'chalan.pe'
EMAIL = 'carlos.calderon@chalan.pe'
PHONE = '972 643 007'

DEFAULT_BANK_NAME = 'BCP – Cuenta de ahorros en soles'

VALIDITY_DAYS = 7


def _env(name):
    return (os.environ.get(name) or '').strip()


def signer_name():
    return _env('FORMAL_QUOTATION_SIGNER') or COMPANY_NAME


def bank_holder():
    """Titular de la cuenta, o '' si no está configurada."""
    return _env('FORMAL_QUOTATION_BANK_HOLDER')


def bank_rows():
    """Las filas de "Forma y medios de pago" con la cuenta, o una que pide los datos."""
    account = _env('FORMAL_QUOTATION_BANK_ACCOUNT')
    if not account:
        return [['Cuenta para el depósito', f'Se envía al confirmar la cotización; escríbanos a {EMAIL}.']]
    rows = [
        ['Titular de la cuenta', bank_holder() or COMPANY_NAME],
        ['Banco', _env('FORMAL_QUOTATION_BANK_NAME') or DEFAULT_BANK_NAME],
        ['N.° de cuenta', account],
    ]
    if _env('FORMAL_QUOTATION_BANK_CCI'):
        rows.append(['CCI (interbancaria)', _env('FORMAL_QUOTATION_BANK_CCI')])
    if _env('FORMAL_QUOTATION_YAPE'):
        rows.append(['Yape', _env('FORMAL_QUOTATION_YAPE')])
    return rows


def contact_line():
    return f'{WEBSITE} | {EMAIL} | {PHONE}'


def footer_line():
    return f'{COMPANY_NAME}  |  {WEBSITE}  |  {EMAIL}  |  {PHONE}'
