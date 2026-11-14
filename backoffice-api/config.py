import os


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'change-me-in-production')
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS')
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_SERVER = os.environ.get('MAIL_SERVER')
    MAIL_PORT = os.environ.get('MAIL_PORT')
    MAIL_SENDER = os.environ.get('MAIL_SENDER')
    ADMIN_MAIL = os.environ.get('ADMIN_MAIL')


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    # Con gunicorn en el servidor (Dockerfile.backoffice-api.prod). Sin
    # SECRET_KEY no arranca: caer a 'change-me-in-production' firmaría las
    # sesiones con una clave que cualquiera conoce.
    DEBUG = False

    @staticmethod
    def check():
        if not os.environ.get('SECRET_KEY'):
            raise RuntimeError('SECRET_KEY is required in production')


class TestingConfig(Config):
    TESTING = True
    SECRET_KEY = 'test-secret-key-at-least-32-bytes-long'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'


config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig,
}
