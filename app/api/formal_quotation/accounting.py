"""La nota de contabilidad de una orden cerrada con cotización formal.

Con cotización formal el trato no sigue el modelo de siempre: Chalán factura el
total con IGV, el cliente le paga todo a la cuenta de `issuer.py` y Chalán le
paga al transportista, a quien Compras le tiene que pedir factura o recibo por
honorarios. Eso queda escrito en `orders.accounting_note`, que el backoffice
muestra como "Esta orden se concilia aparte" y filtra en "Por conciliar".

Se escribe solo cuando la cotización elegida tiene cotización formal (al
elegirla, o al generarla para la que ya estaba elegida): un cliente que bajó el
PDF para comparar no tiene nada que conciliar. Es un bloque que empieza con
`MARKER` y llega hasta la primera línea vacía; lo que un admin escribió fuera de
él se respeta. Si después se elige otra cotización sin cotización formal, el
bloque se borra.
"""
import re

from . import issuer
from .build import money_label
from ..quotation.quotation_status import QuotationStatus
from ...models import FormalQuotation, Quotations

MARKER = '[Cotización formal'
BLOCK_RE = re.compile(r'^\[Cotización formal.*?(?=\n\s*\n|\Z)', re.DOTALL | re.MULTILINE)


def _block(formal, quotation):
    document = formal.document
    totals = document['totals']
    carrier = quotation.carrier_company.name if quotation.carrier_company else 'el transportista'
    payments = '; '.join(f'{stage.lower()} S/ {amount}' for stage, _, amount, _ in document['payment_rows'])
    return '\n'.join([
        f'{MARKER} N.° {formal.id}, nota automática]',
        f'Chalán factura a {formal.business_name} (RUC {formal.ruc}): S/ {money_label(totals["total"])} '
        f'= subtotal {money_label(totals["subtotal"])} + IGV {money_label(totals["igv"])}.',
        f'El cliente paga todo a la cuenta de {issuer.bank_holder() or "Chalán"} ({payments}), '
        f'no en efectivo al transportista.',
        f'Compras: Chalán le paga a {carrier} S/ {money_label(quotation.amount)} (su cotización); '
        f'pedirle factura o recibo por honorarios por ese monto.',
    ])


def sync_accounting_note(order):
    """Pone, cambia o quita el bloque según la cotización elegida. No hace commit."""
    selected = Quotations.query.filter_by(
        order_id=order.id, quotation_status_id=QuotationStatus.Selected(),
    ).order_by(Quotations.id.desc()).first()
    formal = None
    if selected is not None:
        formal = FormalQuotation.query.filter_by(order_id=order.id, quotation_id=selected.id) \
            .order_by(FormalQuotation.id.desc()).first()

    current = order.accounting_note or ''
    rest = BLOCK_RE.sub('', current).strip()
    if formal is None:
        if MARKER in current:
            order.accounting_note = rest or None
        return
    block = _block(formal, selected)
    order.accounting_note = f'{block}\n\n{rest}' if rest else block
