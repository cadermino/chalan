import os
from threading import Thread

import sentry_sdk
from flask import current_app, render_template
from flask_mail import Message

from . import mail

# Lo mínimo para que un envío pueda salir. Si falta cualquiera de estas, el
# correo no se manda: el servidor SMTP y el remitente los usa flask_mail, y
# ADMIN_MAIL es el destinatario de los avisos al equipo.
REQUIRED_MAIL_SETTINGS = ('MAIL_SERVER', 'MAIL_SENDER', 'ADMIN_MAIL')


def missing_mail_settings(config):
    """Variables de correo que faltan, para avisar al arrancar."""
    return [key for key in REQUIRED_MAIL_SETTINGS if not config.get(key)]


def send_async_email(app, msg):
    with app.app_context():
        try:
            mail.send(msg)
            print(f'[Email] delivered to={msg.recipients} subject="{msg.subject}"', flush=True)
        except Exception as e:
            print(f'[Email] SMTP error to={msg.recipients} subject="{msg.subject}": {e}', flush=True)
            # El print se pierde: esto corre en un hilo aparte, así que ni
            # siquiera lo levanta la integración de Flask de Sentry. Por eso el
            # correo de "nuevo transportista" pudo no llegar nunca en prod sin
            # que nadie se enterara. Reportarlo a mano es lo que convierte el
            # fallo en algo visible.
            sentry_sdk.capture_exception(e)


def send_email(to, subject, template, **kwargs):
    app = current_app._get_current_object()
    if not to:
        # Sin destinatario no hay nada que intentar, y flask_mail lo aceptaría
        # igual con recipients=[''] para fallar recién contra el SMTP.
        message = f'[Email] sin destinatario, no se envía subject="{subject}" (¿falta ADMIN_MAIL?)'
        print(message, flush=True)
        sentry_sdk.capture_message(message)
        return None
    if os.getenv('FLASK_ENV') != 'prod' and not subject.startswith('[test]'):
        subject = f'[test]{subject}'
    msg = Message(
        subject,
        sender=('Chalán', app.config['MAIL_SENDER']),
        recipients=[to],
    )
    msg.html = render_template(template + '.html', **kwargs)
    thr = Thread(target=send_async_email, args=[app, msg])
    thr.start()
    return thr
