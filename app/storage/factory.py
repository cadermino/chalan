from flask import current_app


def get_storage():
    backend = current_app.config.get('STORAGE_BACKEND', 's3')
    if backend == 's3':
        from .s3 import S3Storage
        return S3Storage()
    raise ValueError(f'Unknown storage backend: {backend}')
