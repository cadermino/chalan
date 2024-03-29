import os
from flask import render_template
from . import main
from ..countryData import CountryData
from datetime import date

@main.context_processor
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

def country():
    return os.getenv('COUNTRY')

def site_url():
    return os.getenv('SITE_URL')

@main.route('/', methods=['GET'])
def index():
    return render_template('home.html')

@main.route('/preguntas-frecuentes', methods=['GET'])
def faq():
    data_by_country = CountryData(country()).faq()
    return render_template('faq.html', data_by_country=data_by_country)

@main.route('/nosotros', methods=['GET'])
def about():
    return render_template('about.html')

@main.route('/aviso-de-privacidad', methods=['GET'])
def privacy():
    return render_template('privacy.html')

@main.route('/contacto', methods=['GET', 'POST'])
def contact():
    data_by_country = CountryData(country()).contact()
    return render_template('contact.html', data_by_country=data_by_country)

@main.route('/terminos-y-condiciones', methods=['GET'])
def terms():
    data_by_country = CountryData(country()).terms()
    return render_template('terms.html', data_by_country=data_by_country)