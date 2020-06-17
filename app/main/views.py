from flask import render_template
from . import main


@main.route('/', methods=['GET'])
def index():
    return render_template('home.html')

@main.route('/preguntas-frecuentes', methods=['GET'])
def faq():
    return render_template('faq.html')

@main.route('/nosotros', methods=['GET'])
def about():
    return render_template('about.html')

@main.route('/politica-de-privacidad', methods=['GET'])
def privacy():
    return render_template('privacy.html')

@main.route('/contacto', methods=['GET', 'POST'])
def contact():
    return render_template('contact.html')

@main.route('/terminos-y-condiciones', methods=['GET'])
def terms():
    return render_template('terms.html')