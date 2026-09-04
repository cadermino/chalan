import os
from threading import Thread

from flask import current_app, render_template
from flask_mail import Message

from . import mail


def send_async_email(app, msg):
    with app.app_context():
        try:
            mail.send(msg)
            print(f'[Email] delivered to={msg.recipients} subject="{msg.subject}"', flush=True)
        except Exception as e:
            print(f'[Email] SMTP error to={msg.recipients} subject="{msg.subject}": {e}', flush=True)


def send_email(to, subject, template, **kwargs):
    app = current_app._get_current_object()
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
