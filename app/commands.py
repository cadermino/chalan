"""Comandos de mantenimiento: `flask <comando>` dentro del contenedor del API."""
import click

from . import db
from .api.service_request.media_share import legacy_prefix, media_prefix
from .models import ServiceRequestMedia
from .storage import get_storage


def register(app):
    @app.cli.command('quotation-link')
    @click.option('--company', default=1, show_default=True, help='Empresa del link.')
    @click.option('--order', default=None, type=int, help='Orden; por defecto, la última pendiente.')
    @click.option('--base', default='http://localhost/', show_default=True,
                  help='Sitio: localhost para probar los avisos push (local.chalan.mx es http sin service workers).')
    def quotation_link(company, order, base):
        """Imprime un link de cotizar de 7 días para probar en local."""
        from .api.carrier_company import CarrierCompany as CarrierCompanyEntity
        from .models import Order
        if order is None:
            last = Order.query.filter_by(order_status_id=1).order_by(Order.id.desc()).first()
            if last is None:
                raise click.ClickException('No hay órdenes pendientes.')
            order = last.id
        token = CarrierCompanyEntity().generate_carrier_company_token(604800, order, company)
        click.echo(f'{base.rstrip("/")}/quotation/{token}')

    @app.cli.command('web-push-test')
    @click.option('--company', default=1, show_default=True, help='Empresa a la que se avisa.')
    @click.option('--order', default=None, type=int, help='Orden del aviso; por defecto, la última pendiente.')
    @click.option('--base', default='http://localhost/', show_default=True,
                  help='Sitio del link del aviso (en el servidor: https://chalan.pe/).')
    def web_push_test(company, order, base):
        """Manda un aviso de "Nueva orden para cotizar" a los navegadores suscritos
        de una empresa (api/carrier_push.py) y dice a cuántos salió."""
        from .api import carrier_push
        from .models import CarrierPushSubscription, Order
        target = db.session.get(Order, order) if order else \
            Order.query.filter_by(order_status_id=1).order_by(Order.id.desc()).first()
        if target is None:
            raise click.ClickException('No hay esa orden.')
        if not carrier_push.push_enabled():
            raise click.ClickException('Faltan WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY en el entorno.')
        # El mismo link que lleva un aviso real (con token), en localhost.
        from .api.carrier_company import CarrierCompany as CarrierCompanyEntity
        token = CarrierCompanyEntity().generate_carrier_company_token(604800, target.id, company)
        link = f'{base.rstrip("/")}/quotation/{token}'
        rows = CarrierPushSubscription.query.filter_by(carrier_company_id=company,
                                                       vapid_public_key=carrier_push.public_key()).all()
        before = {row.id: row.last_sent_at for row in rows}
        if not carrier_push.notify_carrier(company, carrier_push.new_order_message(target, link), wait=True):
            raise click.ClickException(f'La empresa {company} no tiene navegadores suscritos con la clave actual.')
        db.session.expire_all()
        for row_id, sent_at in before.items():
            row = db.session.get(CarrierPushSubscription, row_id)
            if row is None:
                click.echo(f'Navegador {row_id}: el servicio de push dijo que ya no existe; se borró.')
            elif row.last_sent_at != sent_at and row.last_error is None:
                click.echo(f'Navegador {row_id}: aviso de la orden {target.id} aceptado por el servicio de push.')
            else:
                click.echo(f'Navegador {row_id}: falló ({row.last_error}).')

    @app.cli.command('web-push-keys')
    def web_push_keys():
        """Arma un par de claves VAPID para los avisos push (api/carrier_push.py).
        Van al .env del entorno; cambiarlas deja sin avisos a quienes ya los
        activaron hasta que vuelvan a abrir un link."""
        from .api.carrier_push import generate_keys
        public, private = generate_keys()
        click.echo(f'WEB_PUSH_PUBLIC_KEY={public}')
        click.echo(f'WEB_PUSH_PRIVATE_KEY={private}')
        click.echo('WEB_PUSH_SUBJECT=mailto:carlos.calderon@chalan.pe')

    @app.cli.command('auto-quote')
    def auto_quote():
        """Calcula en silencio lo que cada transportista con tarifas habría
        cotizado en las órdenes avisadas hace 20 minutos o más (api/auto_quote.py).
        Pensado para un cron cada pocos minutos: lo que ya miró no lo repite."""
        from .api.auto_quote import run
        checked = run()
        if checked:
            click.echo(' '.join(f'{order_id}:{skip or "ok"}' for order_id, skip in checked.items()))

    @app.cli.command('auto-quote-backfill')
    @click.option('--apply', is_flag=True, help='Guardar de verdad; sin esto solo cuenta.')
    def auto_quote_backfill(apply):
        """Deja comparables las cotizaciones de antes del cálculo en silencio
        (api/auto_quote.py, `backfill`): el backoffice mide con ellas cuánto
        acierta cada empresa y le sugiere tarifas. Se puede repetir."""
        from .api.auto_quote import backfill
        rows = backfill(apply=apply)
        click.echo(f'{rows} estimaciones {"agregadas" if apply else "por agregar (usa --apply)"}.')

    @app.cli.command('order-versions-backfill')
    @click.option('--apply', is_flag=True, help='Guardar de verdad; sin esto solo cuenta.')
    def order_versions_backfill(apply):
        """La versión 1 del historial de las órdenes pendientes que ya habían
        salido a transportistas (api/order/versions.py, `backfill`): sin ella no
        hay contra qué comparar su próximo cambio. Se puede repetir."""
        from .api.order.versions import backfill
        orders = backfill(apply=apply)
        click.echo(f'{orders} órdenes {"con su versión 1" if apply else "sin versiones (usa --apply)"}.')

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
