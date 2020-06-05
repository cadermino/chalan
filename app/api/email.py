from .. import mail
from flask import current_app, render_template
from flask_mail import Message
from threading import Thread


def send_async_email(app, msg):
    with app.app_context():
        mail.send(msg)


def send_email(to, subject, template, bcc, **kwargs):
    app = current_app._get_current_object()
    msg = Message(
        subject,
        sender=('Chalán', app.config['MAIL_SENDER']),
        bcc=bcc,
        recipients=[to]
    )
    msg.html = render_template(template + '.html', **kwargs)
    thr = Thread(target=send_async_email, args=[app, msg])
    thr.start()
    return thr
