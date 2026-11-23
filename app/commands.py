"""Comandos de mantenimiento: `flask <comando>` dentro del contenedor del API."""
import click

from . import db
from .api.service_request.media_share import legacy_prefix, media_prefix
from .models import ServiceRequestMedia
from .storage import get_storage


def register(app):
    def _links(base, service):
        """Sitio de los links de prueba. Las órdenes se abren en Vue (localhost, por
        nginx: local.chalan.mx es http y no tiene service workers) y los servicios
        en el backoffice, que en local corre en el puerto 5173 sin /backoffice/."""
        if base is None:
            base = 'http://localhost:5173/' if service is not None else 'http://localhost/'
        base = base.rstrip('/')
        prefix = '' if base.endswith(':5173') else '/backoffice'
        return base, prefix

    def _last_pending(model, status_filter):
        return model.query.filter(status_filter).order_by(model.id.desc()).first()

    def _test_target(order, service):
        """La orden o la solicitud del link o del aviso de prueba: la pedida, o la
        última pendiente (y enviada, si es una solicitud)."""
        from .models import Order, ServiceRequest
        if service is not None:
            target = db.session.get(ServiceRequest, service) if service else _last_pending(
                ServiceRequest, (ServiceRequest.status == 'pending') & ServiceRequest.submitted_at.isnot(None))
        else:
            target = db.session.get(Order, order) if order else _last_pending(Order, Order.order_status_id == 1)
        if target is None:
            raise click.ClickException('No hay esa orden o solicitud.')
        return target

    def _carrier_url(target, company, base, service, selected=False):
        from .api.carrier_company import CarrierCompany as CarrierCompanyEntity
        from .api.service_request.notifications import generate_service_request_token
        site, prefix = _links(base, service)
        if service is not None:
            return f'{site}{prefix}/carrier-view/{generate_service_request_token(target.id, company)}'
        token = CarrierCompanyEntity().generate_carrier_company_token(604800, target.id, company)
        return f'{site}/carrier-company/orders/{token}' if selected else f'{site}/quotation/{token}'

    service_option = click.option(
        '--service', default=None, type=int, is_flag=False, flag_value=0,
        help='Una solicitud de servicio en vez de una orden (--service sola: la última enviada pendiente).')

    @app.cli.command('quotation-link')
    @click.option('--company', default=1, show_default=True, help='Empresa del link.')
    @click.option('--order', default=None, type=int, help='Orden; por defecto, la última pendiente.')
    @service_option
    @click.option('--base', default=None,
                  help='Sitio (por defecto localhost: el de nginx para órdenes, el 5173 para servicios).')
    def quotation_link(company, order, service, base):
        """Imprime un link para cotizar (orden, o solicitud con --service) para probar."""
        target = _test_target(order, service)
        click.echo(_carrier_url(target, company, base, service))

    @app.cli.command('web-push-test')
    @click.option('--company', default=1, show_default=True, help='Empresa a la que se avisa.')
    @click.option('--order', default=None, type=int, help='Orden del aviso; por defecto, la última pendiente.')
    @service_option
    @click.option('--base', default=None,
                  help='Sitio del link del aviso (en el servidor: https://chalan.pe/).')
    @click.option('--kind', type=click.Choice(['new', 'changed', 'selected']), default='new', show_default=True,
                  help='Cuál aviso: nueva, la orden cambió (solo órdenes) o te eligieron.')
    def web_push_test(company, order, service, base, kind):
        """Manda uno de los avisos (--kind) a los navegadores suscritos de una
        empresa (api/carrier_push.py) y dice si el servicio de push lo aceptó."""
        from .api import carrier_push
        from .models import CarrierPushSubscription
        if service is not None and kind == 'changed':
            raise click.ClickException('Las solicitudes de servicio no tienen aviso de "cambió".')
        if not carrier_push.push_enabled():
            raise click.ClickException('Faltan WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY en el entorno.')
        target = _test_target(order, service)
        url = _carrier_url(target, company, base, service, selected=kind == 'selected')
        if service is not None:
            message = (carrier_push.service_selected_message if kind == 'selected'
                       else carrier_push.new_service_message)(target, url)
        elif kind == 'selected':
            message = carrier_push.selected_message(target, url)
        else:
            message = carrier_push.new_order_message(target, url, changed=kind == 'changed')
        what = f'la solicitud {target.id}' if service is not None else f'la orden {target.id}'

        rows = CarrierPushSubscription.query.filter_by(carrier_company_id=company,
                                                       vapid_public_key=carrier_push.public_key()).all()
        before = {row.id: row.last_sent_at for row in rows}
        if not carrier_push.notify_carrier(company, message, wait=True):
            raise click.ClickException(f'La empresa {company} no tiene navegadores suscritos con la clave actual.')
        db.session.expire_all()
        for row_id, sent_at in before.items():
            row = db.session.get(CarrierPushSubscription, row_id)
            if row is None:
                click.echo(f'Navegador {row_id}: el servicio de push dijo que ya no existe; se borró.')
            elif row.last_sent_at != sent_at and row.last_error is None:
                click.echo(f'Navegador {row_id}: aviso de {what} aceptado por el servicio de push.')
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
