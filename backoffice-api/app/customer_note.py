"""La nota de una cotización tal como la lee el cliente. Sin base de datos ni
Flask a propósito: es copia de la del API principal
(`app/api/customer_note.py`, que es la que recorta lo que ve el cliente; esta
muestra a los admins cuándo la ve recortada), y `tests/test_quotation_note.py`
compara las dos. Cambiar las dos juntas.

Se quita cada frase (lo que va entre comas, puntos o saltos de línea) que trae
un teléfono o un monto, y si no queda nada no hay nota. Con el teléfono lo
contratan sin pasar por Chalán. Un monto ("carro por viaje 290 soles, estibas
S/ 80 c/u") confunde: el cliente ve un solo total, con la comisión, y otro
número al lado lo hace dudar de cuánto paga, o le muestra el precio del
transportista. Se quita la frase entera y no se marca ("[monto oculto]" se leía
como censura). Monto es un número con moneda, o justo después de
"precio"/"costo": "2 cargadores" o "20 m2" quedan.
"""
import re

PHONE_IN_TEXT = re.compile(r'\+?\d(?:[\s.-]?\d){6,}')

_NUMBER = r'\d{1,3}(?:[.,\s]\d{3}(?!\d))+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?'
_AMOUNT = rf'(?:{_NUMBER})(?:(?:\s*[-–]\s*|\s+(?:a|al|o)\s+)(?:{_NUMBER}))?(?:\s*mil\b)?'
_CURRENCY_AFTER = r'\s*(?:nuevos\s+)?(?:soles|sol|lucas|luca|d[óo]lares|d[óo]lar|PEN|USD)\b'
_AMOUNT_IN_TEXT = re.compile(
    rf'(?:S\s*/\s*\.?|US\$|\$|USD|PEN|soles\s+)\s*(?:{_AMOUNT})(?:{_CURRENCY_AFTER})?'
    rf'|(?<![\w.,])(?:{_AMOUNT}){_CURRENCY_AFTER}',
    re.IGNORECASE,
)
_PRICE_WORD_AMOUNT = re.compile(
    rf'\b(?:precio|costo|cuesta|cobro|cobramos)\s*:?\s*(?:de\s+)?(?:{_AMOUNT})(?![\w.,])'
    r'(?!\s*(?:m|m2|m²|m3|m³|metros|horas?|d[ií]as?|personas?|cargadores?)\b)',
    re.IGNORECASE,
)
# Lo que se quitó se marca con este carácter antes de partir en frases, así el
# punto de "S/ 80.00" o la coma de "1,200" no cortan una frase.
_CUT = '\x00'
_CLAUSE_END = re.compile(r'([,;.!?\n]+)')
_SENTENCE_START = re.compile(r'([.!?\n]\s*)([a-záéíóúñ])')


def note_for_customer(note):
    if not note:
        return note
    marked = note
    for pattern in (_AMOUNT_IN_TEXT, _PRICE_WORD_AMOUNT, PHONE_IN_TEXT):
        marked = pattern.sub(_CUT, marked)
    if _CUT not in marked:
        return note
    parts = _CLAUSE_END.split(marked)
    kept = ''.join(clause + end for clause, end in zip(parts[::2], parts[1::2] + ['']) if _CUT not in clause)
    kept = kept.strip().lstrip(',;.!? ').rstrip(',; ').strip()
    # Si lo quitado cerraba con punto, lo que sigue abre una oración.
    kept = _SENTENCE_START.sub(lambda m: m.group(1) + m.group(2).upper(), kept)
    return kept[:1].upper() + kept[1:] if kept else None
