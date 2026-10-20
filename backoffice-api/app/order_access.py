"""Token del link de acceso de un cliente a su orden (botón "Copiar link del cliente").

Es el mismo token que arma el API principal en `app/api/order_access.py` para el
aviso de "nueva cotización": misma sal, misma SECRET_KEY, mismo contenido
([order_id, customer_id]). El que lo canjea por una sesión es el API principal
(`POST /api/auth/order-access`), así que si cambia el formato allá hay que
cambiarlo aquí.
"""
from flask import current_app
from itsdangerous import URLSafeTimedSerializer

SALT = 'order-access'


def make_token(order):
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=SALT).dumps(
        [order.id, order.customer_id]
    )
