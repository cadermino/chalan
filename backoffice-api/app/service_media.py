"""Token del link para compartir las fotos y videos de un servicio (chalan.pe/v/<token>).

Es el mismo token que lee el API principal en
`app/api/service_request/media_share.py`: misma sal, misma SECRET_KEY, mismo
contenido (el id del servicio). Si cambia el formato allá hay que cambiarlo aquí.
"""
from flask import current_app
from itsdangerous import URLSafeTimedSerializer

SALT = 'service-media'


def make_token(service_request):
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=SALT).dumps(service_request.id)
