from flask import render_template, request
from . import main


@main.route('/', methods=['GET'])
def index():
    domain = request.host
    return render_template('home.html', domain=domain)

@main.route('/preguntas-frecuentes', methods=['GET'])
def faq():
    domain = request.host
    return render_template('faq.html', domain=domain)

@main.route('/nosotros', methods=['GET'])
def about():
    domain = request.host
    return render_template('about.html', domain=domain)

@main.route('/aviso-de-privacidad', methods=['GET'])
def privacy():
    return render_template('privacy.html')

@main.route('/contacto', methods=['GET', 'POST'])
def contact():
    return render_template('contact.html')

@main.route('/terminos-y-condiciones', methods=['GET'])
def terms():
    return render_template('terms.html')