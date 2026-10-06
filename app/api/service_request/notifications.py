import os
from datetime import datetime, timedelta, timezone

import jwt
from flask import current_app

from ... import db
from ...models import (CarrierCompany, CarrierCompanyServiceType,
                       ServiceRequestNotification)
from ..email import send_email
from ..whatsapp import normalize_phone, send_whatsapp
from .quotations import platform_fee_rate, total_with_fee

TOKEN_PURPOSE = 'service_request'
TOKEN_TTL = timedelta(days=10)


def generate_service_request_token(service_request_id, carrier_company_id):
    """Signed link for a carrier to open one request without an account.

    `purpose` keeps it apart from the quotation tokens of orders, which share
    SECRET_KEY: one cannot be replayed on the other's route.
    """
    now = datetime.now(timezone.utc)
    payload = {
        'purpose': TOKEN_PURPOSE,
        'service_request_id': service_request_id,
        'carrier_company_id': carrier_company_id,
        'iat': now,
        'exp': now + TOKEN_TTL,
    }
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')


def _site_url():
    return os.getenv('SITE_URL', '').rstrip('/')


def _pending_carriers(service_request):
    """Active carriers that offer this service and have not been told yet."""
    already_notified = db.session.query(ServiceRequestNotification.carrier_company_id).filter(
        ServiceRequestNotification.service_request_id == service_request.id)
    query = (
        CarrierCompany.query
        .join(CarrierCompanyServiceType,
              CarrierCompanyServiceType.carrier_company_id == CarrierCompany.id)
        .filter(CarrierCompanyServiceType.service_type_id == service_request.service_type_id,
                CarrierCompany.active == 1,
                ~CarrierCompany.id.in_(already_notified))
    )
    if service_request.country_id is not None:
        query = query.filter(CarrierCompany.country_id == service_request.country_id)
    return query.order_by(CarrierCompany.id).all()


def _date_label(service_request):
    return service_request.preferred_date.strftime('%d/%m/%Y') if service_request.preferred_date else None


def notify_service_request(service_request, notify_admin=True):
    """Tells the pending carriers (and, the first time, the admin).

    Returns the ids of the carriers notified. Every carrier is recorded in
    service_request_notifications as it is sent, so calling this again — a
    double click, a resend from the backoffice — only reaches those who were
    not told yet. A failure with one carrier is logged and does not stop the
    rest, nor the response to the customer.
    """
    service_name = service_request.service_type.name
    notified_ids = []
    notified_names = []

    for carrier in _pending_carriers(service_request):
        try:
            if not carrier.email and not normalize_phone(carrier.phone):
                print(f'[ServiceRequest] carrier={carrier.id} has no email or valid phone, skipped', flush=True)
                continue
            token = generate_service_request_token(service_request.id, carrier.id)
            url = f'{_site_url()}/backoffice/carrier-view/{token}'
            if carrier.email:
                send_email(
                    carrier.email,
                    f'Nueva solicitud de {service_name.lower()} Chalán',
                    'email/ask_for_service_quotation',
                    bcc=[],
                    service_name=service_name,
                    neighborhood=service_request.neighborhood,
                    preferred_date=_date_label(service_request),
                    request_url=url,
                )
            send_whatsapp(
                carrier.phone,
                os.getenv('TWILIO_TEMPLATE_SERVICE_REQUEST'),
                {'1': service_name.lower(), '2': url},
                body_label='[Plantilla: Nueva solicitud de servicio]',
            )
            db.session.add(ServiceRequestNotification(
                service_request_id=service_request.id, carrier_company_id=carrier.id))
            db.session.commit()
            notified_ids.append(carrier.id)
            notified_names.append(carrier.name)
        except Exception as e:
            db.session.rollback()
            print(f'[ServiceRequest] error notifying carrier={carrier.id}: {e}', flush=True)

    if notify_admin:
        _notify_admin(service_request, service_name, notified_names)
    return notified_ids


def _notify_admin(service_request, service_name, notified_names):
    admin_url = f'{_site_url()}/backoffice/service-requests/{service_request.id}'
    try:
        notify_email = os.getenv('NOTIFY_EMAIL')
        if notify_email:
            send_email(
                notify_email,
                f'Nueva solicitud de {service_name.lower()} #{service_request.id}',
                'email/service_request_admin',
                bcc=[],
                service_name=service_name,
                whatsapp=service_request.whatsapp,
                neighborhood=service_request.neighborhood,
                preferred_date=_date_label(service_request),
                items_count=len(service_request.items),
                carriers=notified_names,
                admin_url=admin_url,
            )
    except Exception as e:
        print(f'[ServiceRequest] error sending admin email: {e}', flush=True)

    try:
        send_whatsapp(
            os.getenv('NOTIFY_WHATSAPP_PHONE'),
            os.getenv('TWILIO_TEMPLATE_SERVICE_REQUEST'),
            {'1': service_name.lower(), '2': admin_url},
            body_label='[Plantilla: Nueva solicitud de servicio]',
        )
    except Exception as e:
        print(f'[ServiceRequest] error sending admin WhatsApp: {e}', flush=True)


def _money(value):
    return f'S/ {value:,.2f}'


def notify_new_quotation(service_request, quotation, created):
    """Avisa al admin que un transportista mando (o corrigio) su precio.

    Email siempre; WhatsApp solo cuando es nueva, para que un transportista que
    ajusta su monto varias veces no llene el telefono. Un aviso que falla se loguea
    y no tumba la respuesta: la cotizacion ya esta guardada.
    """
    service_name = service_request.service_type.name
    carrier_name = quotation.carrier_company.name if quotation.carrier_company else 'Un transportista'
    admin_url = f'{_site_url()}/backoffice/service-requests/{service_request.id}'

    try:
        notify_email = os.getenv('NOTIFY_EMAIL')
        if notify_email:
            try:
                total = _money(total_with_fee(quotation.amount, platform_fee_rate()))
            except RuntimeError:
                total = None  # sin PLATFORM_FEE no se inventa un total: el aviso sale igual
            subject = (
                f'Nueva cotización de {carrier_name} para la solicitud #{service_request.id}'
                if created else f'{carrier_name} actualizó su cotización (#{service_request.id})'
            )
            send_email(
                notify_email,
                subject,
                'email/service_request_quotation_admin',
                bcc=[],
                service_name=service_name,
                carrier_name=carrier_name,
                created=created,
                amount=_money(quotation.amount),
                total=total,
                note=quotation.note,
                neighborhood=service_request.neighborhood,
                preferred_date=_date_label(service_request),
                quotations_count=len(service_request.quotations),
                admin_url=admin_url,
            )
    except Exception as e:
        print(f'[ServiceRequest] error sending quotation email: {e}', flush=True)

    if created:
        try:
            send_whatsapp(
                os.getenv('NOTIFY_WHATSAPP_PHONE'),
                os.getenv('TWILIO_TEMPLATE_SERVICE_QUOTATION'),
                {'1': carrier_name, '2': admin_url},
                body_label='[Plantilla: Nueva cotización de servicio]',
            )
        except Exception as e:
            print(f'[ServiceRequest] error sending quotation WhatsApp: {e}', flush=True)
