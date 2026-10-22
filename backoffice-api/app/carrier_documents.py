"""Link para que un transportista suba sus documentos (DNI/CE, licencia, tarjeta de propiedad).

Es el mismo token que lee el API principal en `app/api/carrier_documents.py`:
misma sal, misma SECRET_KEY, mismo contenido (el id de la empresa). El que
recibe los archivos es el API principal, dueño de S3, así que si cambia el
formato allá hay que cambiarlo aquí.
"""
import os

from flask import current_app
from itsdangerous import URLSafeTimedSerializer

SALT = 'carrier-documents'


def make_token(company_id):
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=SALT).dumps(company_id)


def documents_url(company_id):
    site = os.environ.get('SITE_URL', 'https://chalan.pe/').rstrip('/')
    return f'{site}/transportistas/documentos/{make_token(company_id)}'
