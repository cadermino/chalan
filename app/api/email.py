import os
from datetime import date
from flask import current_app, render_template
from flask_mail import Message
from threading import Thread
from . import api
from .. import mail
from ..countryData import CountryData

@api.context_processor
def inject_data():
    current_year = date.today().year
    country_data = CountryData(country())
    printable_country = country_data.get_country()
    chalan_phone = country_data.get_phone()
    return dict(
        country=country(),
        site_url=site_url(),
        printable_country=printable_country,
        phone=chalan_phone,
        current_year=current_year,
    )

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

def country():
    return os.getenv('COUNTRY')

def site_url():
    return os.getenv('SITE_URL')