"""Arma el contenido de la cotización formal: cada texto ya escrito.

Es puro (no lee la base salvo lo que se le pasa) para poder probar los textos
sin generar PDFs. El resultado es lo que se guarda en
`formal_quotations.document` y lo que `render.py` dibuja.

Precios: por defecto el precio de la web es el subtotal **sin IGV** y el 18 %
va encima (como las cotizaciones que Carlos hacía a mano). Desde el backoffice
se puede marcar que el precio ya incluye IGV, y entonces se desglosa adentro.
El adelanto es la misma reserva que la web pide yapear (`reservation_breakdown`);
el saldo, todo lo demás, se paga a la cuenta de `issuer.py`.
"""
import os
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from . import issuer

DEFAULT_IGV_RATE = Decimal('0.18')

MONTHS = ('enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
          'septiembre', 'octubre', 'noviembre', 'diciembre')
WEEKDAYS = ('lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo')

# Qué es el servicio, según lo que lleva la orden (orders.load_type; vacío = mudanza).
SERVICE_NAMES = {
    'moving': 'Mudanza',
    'items': 'Traslado de objetos',
    'cargo': 'Flete (transporte de carga)',
    'vehicle': 'Traslado de vehículo',
}
COST_CONCEPTS = {
    'moving': 'Servicio de mudanza',
    'items': 'Servicio de traslado',
    'cargo': 'Servicio de flete',
    'vehicle': 'Servicio de traslado de vehículo',
}
# Los extras de lu_services, menos `cargo` (los cargadores van aparte).
EXTRA_SERVICES = {
    'packaging': 'embalaje de bienes',
    'unpacking': 'desembalaje de bienes',
    'disassembly': 'desarmado de muebles',
    'assembly': 'armado de muebles',
}
PARKING = {0: 'en la puerta', 20: 'a menos de 20 m', 50: 'entre 20 y 50 m', 100: 'a más de 50 m'}

PAY_ON_COMPLETION = 'Al concluir el servicio, el mismo día de su ejecución.'


def igv_rate():
    return Decimal(os.environ.get('IGV_RATE', str(DEFAULT_IGV_RATE)))


def _money(value):
    return Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def money_label(value):
    return f'{_money(value):,.2f}'


def long_date(day):
    return f'{day.day} de {MONTHS[day.month - 1]} de {day.year}'


def _hour_label(moment):
    hour = moment.hour % 12 or 12
    suffix = 'a. m.' if moment.hour < 12 else 'p. m.'
    return f'{hour}:{moment.minute:02d} {suffix}'


def appointment_label(moment):
    if moment is None:
        return 'Por confirmar'
    weekday = WEEKDAYS[moment.weekday()].capitalize()
    return f'{weekday} {long_date(moment.date())}, {_hour_label(moment)}'


def join_es(items):
    items = [i for i in items if i]
    if len(items) <= 1:
        return ''.join(items)
    return ', '.join(items[:-1]) + ' y ' + items[-1]


def _capitalize(text):
    return text[:1].upper() + text[1:] if text else text


def floor_label(floor):
    if floor is None:
        return None
    if floor < 0:
        return f'sótano {abs(floor)}'
    if floor == 0:
        return 'primer piso'
    return f'piso {floor}'


def address_label(detail):
    """'Av. Primavera 939, San Borja 15037, Lima. Piso 4, con ascensor. Estacionamiento en la puerta.'"""
    if detail is None:
        return 'Por confirmar'
    street = (detail.street or '').strip()
    if detail.interior_number:
        street = f'{street}, interior {detail.interior_number.strip()}'
    place = [p for p in (detail.neighborhood, detail.city) if p and p not in street]
    first = ', '.join([s for s in [street, *place] if s]) or 'Por confirmar'
    sentences = [first.rstrip('.') + '.']
    floor = floor_label(detail.floor_number)
    if floor:
        elevator = 'con ascensor' if detail.has_elevator else 'sin ascensor'
        sentences.append(f'{_capitalize(floor)}, {elevator}.')
    parking = PARKING.get(detail.approximate_distance_from_parking)
    if parking:
        sentences.append(f'Estacionamiento {parking}.')
    return ' '.join(sentences)


def validity(issued_on, appointment):
    """Siete días, o hasta el día del servicio si llega antes."""
    until = issued_on + timedelta(days=issuer.VALIDITY_DAYS)
    if appointment is not None and issued_on <= appointment.date() < until:
        return appointment.date(), f'Vigencia: hasta el {long_date(appointment.date())} (día del servicio)'
    return until, f'Vigencia: {issuer.VALIDITY_DAYS} días (hasta el {long_date(until)})'


def amounts(price, prices_include_igv, rate=None):
    """(subtotal, igv, total) en Decimal. `price` es el total que ve el cliente en la web."""
    rate = igv_rate() if rate is None else rate
    price = _money(price)
    if prices_include_igv:
        subtotal = _money(price / (1 + rate))
        return subtotal, price - subtotal, price
    igv = _money(price * rate)
    return price, igv, price + igv


def _percent(part, whole):
    return f'{(part / whole * 100).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)}%'


def build_document(*, order, origin, destination, vehicle, service_names, client,
                   price, reservation_amount, reservation_paid, include_reservation,
                   prices_include_igv, issued_on=None, cargo_weight_label=None):
    """Todo el contenido de la cotización, listo para dibujar.

    - `price`: el total de la cotización como lo ve el cliente en la web.
    - `reservation_amount`: la reserva que la web pide yapear (0 si no hay).
    - `service_names`: los `lu_services.service` de la orden.
    - `client`: {'ruc', 'business_name', 'contact_name', 'contact_email'}.
    """
    issued_on = issued_on or date.today()
    load_type = order.load_type or 'moving'
    services = set(service_names)
    loaders = order.loaders_quantity or 0
    has_loaders = loaders > 0 or 'cargo' in services
    extras = [label for code, label in EXTRA_SERVICES.items() if code in services]

    valid_until, validity_label = validity(issued_on, order.appointment_date)

    # 2. Descripción del servicio
    service_name = SERVICE_NAMES.get(load_type, SERVICE_NAMES['moving'])
    if has_loaders:
        service = f'{service_name}: carga, traslado y descarga de los bienes detallados a continuación.'
    else:
        service = f'{service_name}: traslado de los bienes detallados a continuación, sin carga ni descarga.'

    cargo = (order.comments or '').strip() or 'Según lo coordinado con el cliente.'
    if load_type == 'cargo' and cargo_weight_label:
        cargo = f'{cargo.rstrip(".")}. Peso aproximado: {cargo_weight_label.lower()}.'

    if vehicle is not None and (vehicle.brand or vehicle.model):
        unit = ' '.join(p for p in (vehicle.brand, vehicle.model) if p)
    else:
        unit = 'Unidad de carga'
    if vehicle is not None and vehicle.plates:
        unit = f'{unit}, placa {vehicle.plates.strip().upper()}'
    if loaders > 0:
        crew = f'con conductor y {loaders} cargador{"es" if loaders != 1 else ""}'
    elif has_loaders:
        crew = 'con conductor y cargadores'
    else:
        crew = 'con conductor y sin cargadores'
    unit = f'{unit}, {crew}.'

    if has_loaders:
        origin_floor = floor_label(origin.floor_number) if origin else None
        destination_floor = floor_label(destination.floor_number) if destination else None
        includes = ('Carga en el origen' + (f' ({origin_floor})' if origin_floor else '')
                    + ', transporte y descarga en el destino'
                    + (f' ({destination_floor})' if destination_floor else '') + '.')
    else:
        includes = 'Transporte (flete) con conductor.'
    if extras:
        includes += f' Además: {join_es(extras)}.'

    excluded = []
    if not has_loaders:
        excluded.append('carga y descarga (sin cargadores)')
    if 'packaging' not in services:
        excluded.append('embalaje de bienes')
    assembly = [label for code, label in (('disassembly', 'desarmado'), ('assembly', 'armado'))
                if code not in services]
    if assembly:
        excluded.append('/'.join(assembly) + ' de muebles')
    excluded.append('permisos o pagos de estacionamiento')
    excluded.append('cualquier servicio no detallado en esta cotización')
    excludes = _capitalize(', '.join(excluded[:-1]) + ', y ' + excluded[-1]) + '.'

    service_rows = [
        ['Servicio', service],
        ['Carga a trasladar', cargo],
        ['Dirección de origen', address_label(origin)],
        ['Dirección de destino', address_label(destination)],
        ['Fecha y hora de inicio', appointment_label(order.appointment_date)],
        ['Unidad y personal', unit],
        ['Incluye', includes],
        ['No incluye', excludes],
    ]

    # 3. Costo
    subtotal, igv, total = amounts(price, prices_include_igv)
    rate_label = f'{(igv_rate() * 100).normalize():f}%'
    concept = COST_CONCEPTS.get(load_type, COST_CONCEPTS['moving'])
    cost_rows = [
        [f'{concept} (subtotal, sin IGV)', money_label(subtotal)],
        [f'IGV ({rate_label})', money_label(igv)],
    ]

    # 4. Forma de pago
    reservation = _money(reservation_amount or 0)
    with_reservation = include_reservation and Decimal('0') < reservation < total
    if with_reservation:
        balance = total - reservation
        payment_rows = [
            ['Adelanto recibido' if reservation_paid else 'Adelanto',
             _percent(reservation, total), money_label(reservation),
             'Pagado por el cliente; confirma y reserva la unidad y el personal.' if reservation_paid
             else 'Al aceptar la cotización; confirma y reserva la unidad y el personal.'],
            ['Saldo pendiente', _percent(balance, total), money_label(balance), PAY_ON_COMPLETION],
        ]
    else:
        payment_rows = [['Pago único', '100%', money_label(total), PAY_ON_COMPLETION]]

    # 5. Condiciones
    confirm = 'Confirmar la cotización por correo electrónico'
    requirements = [
        confirm + (' y realizar el pago del adelanto.' if with_reservation and not reservation_paid else '.'),
        ('Bienes listos para carga a la hora acordada' if 'packaging' in services
         else 'Bienes embalados y listos para carga a la hora acordada')
        + ', con un responsable presente en el origen y en el destino.',
        'Acceso libre para el vehículo y el personal, y gestión de permisos del edificio si corresponde '
        '(ingreso de vehículos, ascensor de carga, horarios).',
        'Informar con anticipación objetos frágiles, de alto valor o de gran volumen.',
    ]
    if has_loaders:
        for name, detail in (('origen', origin), ('destino', destination)):
            floor = floor_label(detail.floor_number) if detail else None
            if detail is not None and not detail.has_elevator and floor:
                requirements.append(f'El {name} no cuenta con ascensor: cualquier piso adicional al '
                                    f'{floor} se cotizará aparte.')
    else:
        requirements.append('Al no incluir cargadores, la carga y descarga estará a cargo del cliente.')

    rescheduling = [
        'Reprogramación sin costo, comunicada por escrito con al menos 24 horas de anticipación, '
        'sujeta a disponibilidad de unidad y personal.',
    ]
    if with_reservation:
        rescheduling += [
            'Cancelación con al menos 24 horas de anticipación: se devuelve el adelanto íntegro.',
            'Cancelación o reprogramación con menos de 24 horas, o ausencia en el lugar: el adelanto no '
            'es reembolsable y cubre la reserva de la unidad y el personal.',
        ]
    else:
        rescheduling += [
            'Cancelación con al menos 24 horas de anticipación: sin costo.',
            'Cancelación o reprogramación con menos de 24 horas, o ausencia en el lugar: podrá aplicarse '
            'un cargo por la reserva de la unidad y el personal, informado previamente al cliente.',
        ]
    rescheduling.append('Si el servicio no puede iniciarse por causas atribuibles al cliente y la espera '
                        'supera 30 minutos, el tiempo adicional se cotizará y coordinará con el cliente.')

    if has_loaders:
        damages = [f'{issuer.COMPANY_NAME} responde por los daños a los bienes que sean atribuibles al '
                   'personal durante la carga, el transporte o la descarga.']
    else:
        damages = [f'{issuer.COMPANY_NAME} responde por los daños a los bienes que sean atribuibles al '
                   'conductor durante el transporte. Los daños ocurridos durante la carga y descarga, a '
                   'cargo del cliente, no están cubiertos.']
    damages += [
        'El estado de los bienes se verifica en conjunto con el responsable del cliente al inicio y al '
        'término del servicio.',
        'Cualquier daño debe reportarse el mismo día o, como máximo, dentro de las 24 horas siguientes, '
        'con fotografías y descripción. Se evaluará el caso y, de confirmarse la responsabilidad, se '
        'repara el bien o se repone su valor.',
        'No se cubren bienes con daños previos, mal embalados, ni bienes de valor especial que no hayan '
        'sido declarados antes del servicio. Este servicio no incluye seguro de carga.',
    ]

    acceptance = (f'La aceptación de esta cotización se realiza mediante confirmación por correo '
                  f'electrónico a {issuer.EMAIL}'
                  + (' y el pago del adelanto indicado.' if with_reservation and not reservation_paid else '.'))

    return {
        'issuer': {
            'name': issuer.COMPANY_NAME,
            'name_upper': issuer.COMPANY_NAME_UPPER,
            'ruc': issuer.COMPANY_RUC,
            'address': issuer.COMPANY_ADDRESS,
            'contact_line': issuer.contact_line(),
            'footer': issuer.footer_line(),
            'signer': issuer.signer_name(),
            'signer_contact': f'{issuer.PHONE} | {issuer.EMAIL}',
        },
        'order_id': order.id,
        'issued_on': issued_on.isoformat(),
        'valid_until': valid_until.isoformat(),
        'header_lines': [
            f'Orden N.° {order.id}',
            f'Fecha de emisión: {long_date(issued_on)}',
            validity_label,
        ],
        'client_rows': [
            ['Razón social', client['business_name']],
            ['RUC', client['ruc']],
            ['Contacto', client.get('contact_name') or '—'],
            ['Correo', client.get('contact_email') or '—'],
        ],
        'service_rows': service_rows,
        'cost_rows': cost_rows,
        'total_row': ['TOTAL A PAGAR (incluye IGV)', money_label(total)],
        'cost_note': ('Montos expresados en soles (S/). Costos adicionales: se aplicarán únicamente por '
                      'bienes, condiciones o tiempos no declarados en la solicitud del servicio ni '
                      'detallados en la carga de esta cotización, y serán informados y aprobados por el '
                      'cliente antes de ejecutarse.'),
        'payment_rows': payment_rows,
        'payment_total': ['Total', '100%', money_label(total), ''],
        'bank_rows': issuer.bank_rows(),
        'invoice_note': (f'Una vez confirmado el pago se emitirá la factura electrónica a nombre de '
                         f'{client["business_name"]} (RUC {client["ruc"]}). Se agradece enviar el '
                         f'comprobante de pago a {issuer.EMAIL}.'),
        'conditions': [
            ['Requisitos por parte del cliente', requirements],
            ['Reprogramación y cancelación', rescheduling],
            ['Cobertura ante daños', damages],
        ],
        'acceptance': acceptance,
        'totals': {
            'subtotal': float(subtotal),
            'igv': float(igv),
            'total': float(total),
            'reservation': float(reservation) if with_reservation else 0.0,
            'prices_include_igv': bool(prices_include_igv),
        },
    }
