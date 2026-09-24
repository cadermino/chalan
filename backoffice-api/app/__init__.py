import ast
import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_mail import Mail
from config import config
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

db = SQLAlchemy()
mail = Mail()


def _parse_cors_origins():
    raw = os.environ.get('CORS')
    if not raw:
        return None
    try:
        return ast.literal_eval(raw)
    except (ValueError, SyntaxError):
        return raw


def create_app(config_name='default'):
    sentry_dsn = os.environ.get('SENTRY_DSN')
    if sentry_dsn:
        sentry_sdk.init(
            dsn=sentry_dsn,
            integrations=[FlaskIntegration()],
            environment='production',
            traces_sample_rate=0,
        )

    app = Flask(__name__)
    app.config.from_object(config[config_name])

    db.init_app(app)
    mail.init_app(app)

    # El backoffice-api lee su propio .env, distinto al del API principal, y
    # arranca igual sin configuración de correo: el envío falla después, en un
    # hilo, sin que nadie lo note. Este aviso al arrancar deja el hueco a la
    # vista en `docker-compose logs backoffice-api`.
    from .email import missing_mail_settings
    missing = missing_mail_settings(app.config)
    if missing:
        print(
            f'[Email] CORREO DESACTIVADO — faltan {", ".join(missing)} en el entorno. '
            'No se enviarán avisos (p. ej. "Nuevo transportista registrado").',
            flush=True,
        )
    CORS(app, origins=_parse_cors_origins(), supports_credentials=True)

    from .auth import auth as auth_blueprint
    app.register_blueprint(auth_blueprint, url_prefix='/auth')

    from .api import api as api_blueprint
    app.register_blueprint(api_blueprint, url_prefix='/api')

    with app.app_context():
        from .models import AdminUser  # noqa: F401
        db.create_all()

    return app
