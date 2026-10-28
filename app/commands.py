"""Comandos de mantenimiento: `flask <comando>` dentro del contenedor del API."""
import click

from . import db
from .api.service_request.media_share import legacy_prefix, media_prefix
from .models import ServiceRequestMedia
from .storage import get_storage


def register(app):
    @app.cli.command('move-service-media')
    @click.option('--apply', is_flag=True, help='Mover de verdad; sin esto solo cuenta.')
    def move_service_media(apply):
        """Mueve las fotos y videos de servicios que siguen en la carpeta del
        public_id a la carpeta firmada (service_request/media_share.py), y
        actualiza su URL. Copia, guarda y recién entonces borra el original:
        si algo se corta a mitad, se puede volver a correr."""
        storage = get_storage()
        pending = [m for m in ServiceRequestMedia.query.order_by(ServiceRequestMedia.id).all()
                   if m.storage_key.startswith(legacy_prefix(m.service_request))]
        click.echo(f'{len(pending)} archivos en la carpeta del public_id')
        if not apply:
            click.echo('Nada movido (usa --apply).')
            return
        moved = 0
        for media in pending:
            old_key = media.storage_key
            new_key = media_prefix(media.service_request) + old_key.rsplit('/', 1)[1]
            storage.copy(old_key, new_key)
            media.storage_key = new_key
            media.url = storage.public_url(new_key)
            db.session.commit()
            try:
                storage.delete(old_key)
            except Exception as e:  # el archivo ya está a salvo en la carpeta nueva
                click.echo(f'  no se pudo borrar {old_key}: {e}')
            moved += 1
        click.echo(f'{moved} archivos movidos.')
