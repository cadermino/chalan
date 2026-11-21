"""Dibuja la cotización formal (el dict de `build.py`) como PDF A4 con ReportLab.

Copia el diseño de las cotizaciones hechas a mano: encabezado con Chalán a la
izquierda y "COTIZACIÓN" a la derecha, secciones numeradas en azul, tablas de
dos columnas con la etiqueta sombreada y un pie con "Página N".
"""
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (KeepTogether, ListFlowable, ListItem, Paragraph, SimpleDocTemplate,
                                Spacer, Table, TableStyle)

NAVY = colors.HexColor('#1F3864')
TEXT = colors.HexColor('#222222')
MUTED = colors.HexColor('#555555')
LABEL_BG = colors.HexColor('#EEF2F7')
GRID = colors.HexColor('#C8D1DC')
RULE = colors.HexColor('#CCCCCC')

MARGIN_X = 18 * mm
WIDTH = A4[0] - 2 * MARGIN_X

BASE = ParagraphStyle('base', fontName='Helvetica', fontSize=9.5, leading=12.5, textColor=TEXT)
BOLD = ParagraphStyle('bold', parent=BASE, fontName='Helvetica-Bold')
RIGHT = ParagraphStyle('right', parent=BASE, alignment=TA_RIGHT)
RIGHT_BOLD = ParagraphStyle('right_bold', parent=BOLD, alignment=TA_RIGHT)
SMALL = ParagraphStyle('small', parent=BASE, fontSize=8.5, leading=11, textColor=MUTED)
SMALL_RIGHT = ParagraphStyle('small_right', parent=SMALL, alignment=TA_RIGHT)
COMPANY = ParagraphStyle('company', parent=BOLD, fontSize=18, leading=22, textColor=NAVY)
TITLE = ParagraphStyle('title', parent=COMPANY, alignment=TA_RIGHT)
SECTION = ParagraphStyle('section', parent=BOLD, fontSize=11.5, leading=14, textColor=NAVY,
                         spaceBefore=8, spaceAfter=4)
SUBSECTION = ParagraphStyle('subsection', parent=BOLD, spaceBefore=3, spaceAfter=2)
SIGNER = ParagraphStyle('signer', parent=SMALL, fontName='Helvetica-Bold')


def _p(text, style=BASE):
    return Paragraph(escape(str(text)).replace('\n', '<br/>'), style)


def _label_table(rows, label_width=52 * mm):
    data = [[_p(label, BOLD), _p(value)] for label, value in rows]
    table = Table(data, colWidths=[label_width, WIDTH - label_width])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), LABEL_BG),
        ('GRID', (0, 0), (-1, -1), 0.5, GRID),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    return table


def _header(doc):
    issuer = doc['issuer']
    left = [
        _p(issuer['name_upper'], COMPANY),
        _p(f'RUC: {issuer["ruc"]}', SMALL),
        _p(issuer['address'], SMALL),
        _p(issuer['contact_line'], SMALL),
    ]
    right = [_p('COTIZACIÓN', TITLE)] + [_p(line, SMALL_RIGHT) for line in doc['header_lines']]
    table = Table([[left, right]], colWidths=[WIDTH * 0.58, WIDTH * 0.42])
    table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LINEBELOW', (0, 0), (-1, 0), 1.5, NAVY),
    ]))
    return table


def _cost_table(doc):
    amount_width = 45 * mm
    data = [[_p('Concepto', BOLD), _p('Importe (S/)', RIGHT_BOLD)]]
    data += [[_p(concept), _p(amount, RIGHT)] for concept, amount in doc['cost_rows']]
    label, total = doc['total_row']
    data.append([_p(label, BOLD), _p(total, RIGHT_BOLD)])
    table = Table(data, colWidths=[WIDTH - amount_width, amount_width])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), LABEL_BG),
        ('BACKGROUND', (0, -1), (-1, -1), LABEL_BG),
        ('GRID', (0, 0), (-1, -1), 0.5, GRID),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    return table


def _payment_table(doc):
    widths = [40 * mm, 25 * mm, 25 * mm]
    widths.append(WIDTH - sum(widths))
    data = [[_p('Etapa', BOLD), _p('Porcentaje', BOLD), _p('Monto (S/)', RIGHT_BOLD), _p('Oportunidad', BOLD)]]
    for stage, percent, amount, when in doc['payment_rows']:
        data.append([_p(stage), _p(percent), _p(amount, RIGHT), _p(when)])
    stage, percent, amount, when = doc['payment_total']
    data.append([_p(stage, BOLD), _p(percent, BOLD), _p(amount, RIGHT_BOLD), _p(when)])
    table = Table(data, colWidths=widths)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), LABEL_BG),
        ('BACKGROUND', (0, -1), (-1, -1), LABEL_BG),
        ('GRID', (0, 0), (-1, -1), 0.5, GRID),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    return table


def _bullets(items):
    return ListFlowable(
        [ListItem(_p(item), leftIndent=12, value='•') for item in items],
        bulletType='bullet', start='•', leftIndent=12, bulletFontSize=8, bulletOffsetY=-1,
    )


def _footer(doc):
    text = doc['issuer']['footer']

    def draw(canvas, pdf):
        canvas.saveState()
        y = 12 * mm
        canvas.setStrokeColor(RULE)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN_X, y + 4 * mm, A4[0] - MARGIN_X, y + 4 * mm)
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(MARGIN_X, y, text)
        canvas.drawRightString(A4[0] - MARGIN_X, y, f'Página {pdf.page}')
        canvas.restoreState()
    return draw


def render_pdf(doc):
    """Bytes del PDF."""
    buffer = BytesIO()
    pdf = SimpleDocTemplate(
        buffer, pagesize=A4, leftMargin=MARGIN_X, rightMargin=MARGIN_X,
        topMargin=16 * mm, bottomMargin=22 * mm,
        title=f'Cotización – Orden {doc["order_id"]}', author=doc['issuer']['name'],
    )
    story = [
        _header(doc),
        Spacer(1, 4 * mm),
        _p('1. Datos del cliente', SECTION),
        _label_table(doc['client_rows']),
        _p('2. Descripción del servicio', SECTION),
        _label_table(doc['service_rows']),
        KeepTogether([
            _p('3. Costo del servicio', SECTION),
            _cost_table(doc),
            Spacer(1, 2 * mm),
            _p(doc['cost_note'], SMALL),
        ]),
        KeepTogether([
            _p('4. Forma y medios de pago', SECTION),
            _payment_table(doc),
            Spacer(1, 2 * mm),
            _label_table(doc['bank_rows']),
            Spacer(1, 2 * mm),
            _p(doc['invoice_note'], SMALL),
        ]),
        _p('5. Condiciones del servicio', SECTION),
    ]
    for title, items in doc['conditions']:
        story += [_p(title, SUBSECTION), _bullets(items)]
    issuer = doc['issuer']
    story.append(KeepTogether([
        _p('6. Aceptación', SECTION),
        _p(doc['acceptance']),
        Spacer(1, 4 * mm),
        _p(issuer['signer'], SIGNER),
        _p(issuer['name'], SMALL),
        _p(issuer['signer_contact'], SMALL),
    ]))
    footer = _footer(doc)
    pdf.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()
