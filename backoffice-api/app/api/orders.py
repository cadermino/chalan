import os
import re
from datetime import datetime, timedelta, timezone

import jwt
import requests
from flask import jsonify, g, current_app, request

from . import api
from .decorators import login_required
from ..models import Order, OrderDetail, Quotation, ReferredOrder, Customer, CarrierCompany, OrdersService, LuService, OrderImage, AdminUser, Payment, ROLE_CARRIER, ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_REAL_ESTATE
from .. import db

QUOTATION_STATUS_SELECTED = 2


def _financial_breakdown(order):
    """Admin-only money split for an order.

    Mirrors how the main API builds the customer price: the carrier's quotation
    is stored raw and the agent commission + platform fee ride on top. Only the
    platform fee is Chalán's own sale, so it's the only leg carrying IGV — the
    agent bills it by recibo por honorarios (4ta categoría, sin IGV) and the
    carrier collects its cash straight from the customer.

    Returns None when no quotation has been picked yet: there is nothing to
    split until then.
    """
    # Una orden puede tener varias cotizaciones, pero solo una en estado
    # Seleccionada: pickQuotation() degrada la anterior a Activa antes de
    # marcar la nueva. El order_by es defensivo — si ese invariante alguna vez
    # se rompe, más vale tomar siempre la última de forma determinista que
    # dejarlo al orden que devuelva la base.
    quotation = Quotation.query.filter_by(
        order_id=order.id, quotation_status_id=QUOTATION_STATUS_SELECTED
    ).order_by(Quotation.id.desc()).first()
    if quotation is None or quotation.amount is None:
        return None

    base = float(quotation.amount)
    igv_rate = float(os.environ.get('IGV_RATE', 0.18))

    agent_code = None
    agent_commission = 0.0
    referred = ReferredOrder.query.filter_by(order_id=order.id).first()
    if referred:
        agent = db.session.get(AdminUser, referred.admin_user_id)
        if agent:
            agent_code = agent.referral_code
        # La comisión se congela al elegir la cotización. Se usa la guardada y
        # no la tasa actual del agente: si se le renegoció el porcentaje, las
        # órdenes viejas tienen que seguir mostrando lo que se le debe.
        if referred.commission is not None:
            agent_commission = float(referred.commission)
        elif agent:
            agent_commission = base * float(agent.commission_rate or 0)

    # Se prefiere el total grabado al elegir: es lo que se le cotizó al cliente
    # y lo que va a pagar. Derivar de ahí hace que el desglose siempre sume el
    # total exacto, aunque PLATFORM_FEE haya cambiado después. Sin total
    # grabado (cotización aún no elegida) se estima con la tasa de hoy.
    current_fee = float(os.environ.get('PLATFORM_FEE', 0.1))
    stored_total = float(order.total_amount) if order.total_amount else None
    if stored_total is not None:
        total = stored_total
        platform_gross = total - base - agent_commission
    else:
        platform_gross = base * current_fee
        total = base + agent_commission + platform_gross

    # El IGV se deriva del neto ya redondeado, no del exacto: así neto + IGV
    # siempre suma el bruto al céntimo y las filas del desglose cuadran con el
    # total, que es como se va a emitir la boleta (base imponible + IGV).
    platform_net = round(platform_gross / (1 + igv_rate), 2)
    platform_igv = round(platform_gross - platform_net, 2)

    return {
        'carrier_amount': round(base, 2),
        'agent_code': agent_code,
        'agent_commission': round(agent_commission, 2),
        'platform_gross': round(platform_gross, 2),
        'platform_igv': platform_igv,
        'platform_net': platform_net,
        'igv_rate': igv_rate,
        # Tasa que realmente se le aplicó a esta orden. Sirve para distinguir
        # las cotizadas antes del cambio de PLATFORM_FEE de las de después.
        'effective_fee_rate': round(platform_gross / base, 4) if base else None,
        # Lo que se cobra por adelantado (Yape): todo lo que no es del
        # transportista. Mismo número que muestra el modal del cliente.
        'reservation_amount': round(agent_commission + platform_gross, 2),
        'total_amount': round(total, 2),
        'is_estimate': stored_total is None,
        # Para señalar las órdenes cerradas con la tasa anterior, donde el IGV
        # salió del margen en vez de trasladarse al cliente. No se re-cotiza
        # nada: es solo referencia contra lo que costaría hoy.
        'current_fee_rate': current_fee,
        'total_at_current_rate': round(base + agent_commission + base * current_fee, 2),
    }


DEFAULT_PER_PAGE = 25
MAX_PER_PAGE = 100


def _pagination_args():
    """Lee page/per_page de la query string, tolerando basura.

    Los valores llegan de la URL, que el usuario puede editar a mano o heredar
    de un enlace viejo, así que nada de 400: se saneàn a un rango usable. El
    tope de per_page evita que `?per_page=99999` se traiga la tabla entera.
    """
    def _as_int(name, fallback):
        try:
            return int(request.args.get(name, fallback))
        except (TypeError, ValueError):
            return fallback

    page = max(1, _as_int('page', 1))
    per_page = min(max(1, _as_int('per_page', DEFAULT_PER_PAGE)), MAX_PER_PAGE)
    return page, per_page


def _paginate(query, page, per_page):
    """Devuelve (filas, metadatos). Pide una página pasada del final devuelve
    lista vacía en vez de recortar a la última: la UI muestra "sin resultados"
    y el usuario ve que no hay nada ahí, en vez de creer que navegó bien."""
    total = query.count()
    rows = query.limit(per_page).offset((page - 1) * per_page).all()
    pages = max(1, -(-total // per_page))  # techo sin importar math
    return rows, {
        'page': page,
        'per_page': per_page,
        'total': total,
        'pages': pages,
    }


def _street_without_number(street):
    """Strips the house/building number so a carrier can't go straight to the
    customer's door before winning the job through the platform. Cuts at the
    first digit run (e.g. "Av. Larco 1301" -> "Av. Larco"); street names that
    themselves start with a number (rare) will be over-trimmed."""
    if not street:
        return street
    return re.split(r'\s*\d', street, maxsplit=1)[0].strip(' ,') or street


def _address_payload(addr, is_admin, reveal_full):
    if addr is None:
        return None
    if is_admin:
        return addr.to_dict_full()
    data = addr.to_dict()
    if not reveal_full:
        data['street'] = _street_without_number(data['street'])
    return data


def _generate_quotation_token(carrier_company_id, order_id):
    payload = {
        'carrier_company_id': carrier_company_id,
        'order_id': order_id,
        'exp': datetime.now(timezone.utc) + timedelta(seconds=864000),
        'iat': datetime.now(timezone.utc),
    }
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')


def _generate_review_token(order_id, customer_id, carrier_company_id):
    payload = {
        'order_id': order_id,
        'customer_id': customer_id,
        'carrier_company_id': carrier_company_id,
        'exp': datetime.now(timezone.utc) + timedelta(seconds=2592000),
        'iat': datetime.now(timezone.utc),
    }
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')


def _customer_clauses(clauses):
    """Envuelve condiciones sobre `customers` en una subconsulta por id.

    Subconsulta en vez de join para no duplicar filas ni alterar el count() de
    la paginación.
    """
    if not clauses:
        return []
    return [Order.customer_id.in_(
        db.session.query(Customer.id).filter(db.or_(*clauses))
    )]


def _order_search_filter(search, include_customer):
    """Arma el OR de búsqueda de la lista de órdenes.

    Un término de solo dígitos es un número de orden o un teléfono, nunca un
    nombre, así que no se compara contra nombre ni email: buscar "3" tiene que
    traer la orden #3, no las 174 filas cuyo email contiene un 3. Se acepta con
    o sin `#`. El teléfono entra solo desde 4 dígitos, por lo mismo: como
    fragmento, "3" calza con casi toda la tabla.

    El nombre se compara sobre la concatenación de los tres campos, no columna
    por columna, para que "Juan Pérez" encuentre al cliente igual que "Juan".
    """
    like = f'%{search}%'
    clauses = []
    phone_clauses = []
    if include_customer:
        phone_clauses = [Customer.mobile_phone.ilike(like), Customer.phone.ilike(like)]

    digits = search.lstrip('#').strip()
    if digits.isdigit():
        # El tope de dígitos no es cosmético: un número más largo que un int32
        # desborda la columna y Postgres aborta la consulta entera.
        if len(digits) <= 9:
            clauses.append(Order.id == int(digits))
        if len(digits) >= 4:
            clauses += _customer_clauses(phone_clauses)
            # Órdenes tomadas por teléfono, que todavía no tienen cliente.
            if include_customer:
                clauses.append(Order.lead_phone.ilike(like))
    elif include_customer:
        clauses += _customer_clauses([
            db.func.concat(
                Customer.name, ' ', Customer.paternal_last_name,
                ' ', Customer.maternal_last_name,
            ).ilike(like),
            Customer.email.ilike(like),
            *phone_clauses,
        ])

    # Sin ninguna cláusula aplicable (un transportista buscando por nombre, que
    # no tiene permitido) se devuelve vacío, nunca la lista completa.
    return db.or_(*clauses) if clauses else db.false()


@api.route('/orders/pending', methods=['GET'])
@login_required
def list_pending_orders():
    """
    For carrier_company users: returns orders that have been sent to them
    (exist in quotations table for their company, with status active=1)
    or all active orders without a quotation from them yet.

    Practically: returns orders where this carrier_company has a quotation
    with status_id=1 (pending/active) or no quotation at all (order_status_id=2 = sent).
    """
    user = g.current_user

    if user.role == ROLE_CARRIER:
        company_id = user.carrier_company_id
        status_filter = [1, 2]
    elif user.role in (ROLE_SUPERADMIN, ROLE_ADMIN):
        company_id = None  # superadmin sees all, no company filter
        status_param = request.args.get('status')
        if status_param == 'all':
            status_filter = None
        elif status_param:
            status_filter = [int(s) for s in status_param.split(',') if s.isdigit()]
        else:
            status_filter = [1, 2]
    else:
        return jsonify({'message': 'forbidden'}), 403

    query = Order.query
    if status_filter is not None:
        query = query.filter(Order.order_status_id.in_(status_filter))

    # El transportista no ve nombre ni teléfono del cliente en esta lista, así
    # que tampoco puede buscar por ellos: solo por número de orden.
    search = request.args.get('q', '').strip()
    if search:
        query = query.filter(_order_search_filter(
            search, include_customer=user.role in (ROLE_SUPERADMIN, ROLE_ADMIN)
        ))

    # El desempate por id no es cosmético: con offset/limit, dos órdenes que
    # comparten created_date pueden intercambiarse entre consultas y aparecer
    # dos veces o ninguna al pasar de página.
    query = query.order_by(Order.created_date.desc(), Order.id.desc())

    page, per_page = _pagination_args()
    all_sent_orders, pagination = _paginate(query, page, per_page)

    # Quotations already submitted (per company if carrier_company, all if admin)
    if company_id is not None:
        own_quotation_by_order = {
            q.order_id: q
            for q in Quotation.query.filter_by(carrier_company_id=company_id).all()
        }
    else:
        own_quotation_by_order = {}  # superadmin: show all regardless

    is_admin = user.role in (ROLE_SUPERADMIN, ROLE_ADMIN)
    site_url = os.environ.get('SITE_URL', 'https://chalan.pe/')

    result = []
    for order in all_sent_orders:
        has_quotation = order.id in own_quotation_by_order
        own_quotation = own_quotation_by_order.get(order.id)
        reveal_full_address = own_quotation is not None and own_quotation.quotation_status_id == QUOTATION_STATUS_SELECTED
        details = list(order.order_details)
        origin = next((d for d in details if d.type == 'carry_from'), None)
        destination = next((d for d in details if d.type == 'deliver_to'), None)

        # For superadmin, quotation_url is not applicable (no fixed company)
        quotation_url = None
        if company_id is not None:
            token = _generate_quotation_token(company_id, order.id)
            quotation_url = f"{site_url}quotation/{token}"

        customer = db.session.get(Customer, order.customer_id) if order.customer_id else None
        customer_name = None
        customer_phone = None
        if customer:
            customer_name = ' '.join(filter(None, [customer.name, customer.paternal_last_name]))
            if user.role in (ROLE_SUPERADMIN, ROLE_ADMIN):
                customer_phone = customer.mobile_phone

        result.append({
            **order.to_dict(),
            'has_quotation': has_quotation,
            'quotation_url': quotation_url,
            'origin': _address_payload(origin, is_admin, reveal_full_address),
            'destination': _address_payload(destination, is_admin, reveal_full_address),
            'customer_name': customer_name,
            'customer_phone': customer_phone,
            'lead_phone': order.lead_phone if is_admin else None,
        })

    # `pagination` se agrega sin tocar `orders`, así que cualquier consumidor
    # que solo leía la lista sigue funcionando igual.
    return jsonify({'orders': result, 'pagination': pagination}), 200


@api.route('/orders/my-orders', methods=['GET'])
@login_required
def list_my_orders():
    user = g.current_user
    if user.role != ROLE_CARRIER:
        return jsonify({'message': 'carrier company access required'}), 403

    # Orders where this carrier's quotation was selected (status 2) and order is in_progress (status 2)
    accepted_quotations = Quotation.query.filter_by(
        carrier_company_id=user.carrier_company_id,
        quotation_status_id=2,
    ).all()

    order_ids = [q.order_id for q in accepted_quotations]
    quotation_by_order = {q.order_id: q for q in accepted_quotations}

    orders = Order.query.filter(
        Order.id.in_(order_ids),
        Order.order_status_id == 2,
    ).order_by(Order.created_date.desc()).all()

    result = []
    for order in orders:
        details = list(order.order_details)
        origin = next((d for d in details if d.type == 'carry_from'), None)
        destination = next((d for d in details if d.type == 'deliver_to'), None)
        customer = db.session.get(Customer, order.customer_id) if order.customer_id else None
        customer_name = None
        if customer:
            customer_name = ' '.join(filter(None, [customer.name, customer.paternal_last_name]))
        quotation = quotation_by_order.get(order.id)
        result.append({
            **order.to_dict(),
            'origin': origin.to_dict() if origin else None,
            'destination': destination.to_dict() if destination else None,
            'customer_name': customer_name,
            'quotation_amount': quotation.amount if quotation else None,
        })

    return jsonify({'orders': result}), 200


@api.route('/orders', methods=['POST'])
@login_required
def create_order():
    """Creates an order on behalf of an existing customer - for support cases
    where an admin needs to place an order the customer described over a
    call/WhatsApp instead of them using the site themselves.

    Proxies to the main API's own /api/v1/order (create) and
    /api/v1/order/<id> (fill in details) endpoints server-to-server, rather
    than writing rows directly via this app's models: OrderDetail.type is a
    native Postgres enum (order_detail_type), but backoffice-api's mirror
    model declares it as a plain String - fine for reading/updating existing
    rows, but INSERTs fail with a DatatypeMismatch since SQLAlchemy emits an
    explicit ::VARCHAR cast Postgres won't implicitly coerce into the enum
    column. The main API's model has the real enum type, so its endpoints
    don't hit this.

    Sends requestQuotationFromCarrierCompany just like Step-three.vue does
    for customer-created orders (unless the admin unchecks "notify carriers"
    in the form), so carriers get the same emails/WhatsApp once the order
    actually has an appointment_date and comments - if either is still
    missing, the main API's own completeness check keeps it from sending
    anything, same as it would for a customer mid-flow.
    """
    user = g.current_user
    if user.role != ROLE_SUPERADMIN:
        return jsonify({'message': 'forbidden'}), 403

    data = request.get_json() or {}

    customer_id = data.get('customer_id')
    if not customer_id:
        return jsonify({'message': 'customer_id is required'}), 400
    customer = Customer.query.get(customer_id)
    if customer is None:
        return jsonify({'message': 'customer not found'}), 404

    origin = data.get('origin') or {}
    destination = data.get('destination') or {}
    if not origin.get('street'):
        return jsonify({'message': 'origin.street is required'}), 400
    if not destination.get('street'):
        return jsonify({'message': 'destination.street is required'}), 400

    appointment_date_str = None
    if data.get('appointment_date'):
        try:
            appointment_date_str = datetime.fromisoformat(data['appointment_date']).strftime('%Y-%m-%d %H:%M:%S')
        except ValueError:
            return jsonify({'message': 'invalid appointment_date format'}), 400

    internal_api = os.getenv('INTERNAL_API_URL', 'http://flask-api:8001')

    try:
        create_res = requests.post(
            f'{internal_api}/api/v1/order',
            json={
                'customer': {'customer_id': customer_id},
                'orderDetailsOrigin': {
                    'from_street': origin.get('street'),
                    'from_floor_number': origin.get('floor_number'),
                    'from_country': origin.get('country'),
                },
                'orderDetailsDestination': {
                    'to_street': destination.get('street'),
                    'to_floor_number': destination.get('floor_number'),
                    'to_country': destination.get('country'),
                },
            },
            timeout=10,
        )
    except requests.RequestException:
        return jsonify({'message': 'could not reach the order service'}), 502
    if create_res.status_code != 201:
        return jsonify({'message': 'failed to create order'}), 502
    order_id = create_res.json().get('order_id')

    try:
        update_res = requests.put(
            f'{internal_api}/api/v1/order/{order_id}',
            json={
                'customer': {'customer_id': customer_id},
                'order': {
                    'appointment_date': appointment_date_str,
                    'comments': data.get('comments'),
                    'approximate_budget': data.get('approximate_budget'),
                    'loaders_quantity': data.get('loaders_quantity'),
                },
                'orderDetailsOrigin': {
                    'from_street': origin.get('street'),
                    'from_floor_number': origin.get('floor_number'),
                    'from_country': origin.get('country'),
                    'from_map_url': origin.get('map_url'),
                    'from_approximate_distance_from_parking': origin.get('approximate_distance_from_parking'),
                    'from_has_elevator': 1 if origin.get('has_elevator') else 0,
                },
                'orderDetailsDestination': {
                    'to_street': destination.get('street'),
                    'to_floor_number': destination.get('floor_number'),
                    'to_country': destination.get('country'),
                    'to_map_url': destination.get('map_url'),
                    'to_approximate_distance_from_parking': destination.get('approximate_distance_from_parking'),
                    'to_has_elevator': 1 if destination.get('has_elevator') else 0,
                },
                'services': {
                    'cargo': '1' if data.get('cargo') else '0',
                    'packaging': '1' if data.get('packaging') else '0',
                },
                'requestQuotationFromCarrierCompany': bool(data.get('notify_carriers', True)),
            },
            timeout=10,
        )
    except requests.RequestException:
        return jsonify({'message': 'order created but failed to fill in details', 'order_id': order_id}), 502
    if update_res.status_code != 200:
        return jsonify({'message': 'order created but failed to fill in details', 'order_id': order_id}), 502

    emails_sent = update_res.json().get('emails_sent_by_company_id', [])
    return jsonify({'order_id': order_id, 'emails_sent_by_company_id': emails_sent}), 201


@api.route('/orders/<int:order_id>/images', methods=['POST'])
@login_required
def upload_order_image(order_id):
    """Attaches a reference photo to an order created from the backoffice
    (e.g. something the customer sent over WhatsApp). Proxies the multipart
    upload to the main API's /order/recognize-items, which is what actually
    stores it in S3 and creates the OrderImage row - that endpoint also
    runs AI item recognition on it, which we ignore here since an admin
    already typed the item list by hand."""
    user = g.current_user
    if user.role != ROLE_SUPERADMIN:
        return jsonify({'message': 'forbidden'}), 403

    if 'image' not in request.files:
        return jsonify({'message': 'image is required'}), 400
    image_file = request.files['image']

    internal_api = os.getenv('INTERNAL_API_URL', 'http://flask-api:8001')
    try:
        res = requests.post(
            f'{internal_api}/api/v1/order/recognize-items',
            files={'image': (image_file.filename, image_file.stream, image_file.content_type)},
            data={'order_id': order_id},
            timeout=30,
        )
    except requests.RequestException:
        return jsonify({'message': 'could not reach the upload service'}), 502
    if res.status_code != 200:
        try:
            message = res.json().get('message', 'failed to upload image')
        except ValueError:
            message = 'failed to upload image'
        return jsonify({'message': message}), 502

    return jsonify({'image': res.json().get('image')}), 201


@api.route('/orders/<int:order_id>/images/<int:image_id>', methods=['DELETE'])
@login_required
def delete_order_image(order_id, image_id):
    """Removes a reference photo from an order, proxying to the main API's
    delete route which handles both the S3 object and the OrderImage row."""
    user = g.current_user
    if user.role != ROLE_SUPERADMIN:
        return jsonify({'message': 'forbidden'}), 403

    internal_api = os.getenv('INTERNAL_API_URL', 'http://flask-api:8001')
    try:
        res = requests.delete(
            f'{internal_api}/api/v1/order/{order_id}/image/{image_id}',
            timeout=10,
        )
    except requests.RequestException:
        return jsonify({'message': 'could not reach the upload service'}), 502
    if res.status_code != 200:
        try:
            message = res.json().get('message', 'failed to delete image')
        except ValueError:
            message = 'failed to delete image'
        return jsonify({'message': message}), 502

    return jsonify({'message': 'deleted'}), 200


@api.route('/orders/<int:order_id>', methods=['GET'])
@login_required
def get_order(order_id):
    """Order detail with addresses and current quotation for this carrier company."""
    user = g.current_user
    if user.role not in (ROLE_CARRIER, ROLE_SUPERADMIN, ROLE_ADMIN):
        return jsonify({'message': 'forbidden'}), 403

    company_id = user.carrier_company_id if user.role == ROLE_CARRIER else None
    is_admin = user.role in (ROLE_SUPERADMIN, ROLE_ADMIN)
    order = Order.query.get(order_id)
    if order is None:
        return jsonify({'message': 'order not found'}), 404

    details = list(order.order_details)
    origin = next((d for d in details if d.type == 'carry_from'), None)
    destination = next((d for d in details if d.type == 'deliver_to'), None)

    existing_quotation = Quotation.query.filter_by(
        order_id=order_id, carrier_company_id=company_id
    ).first() if company_id is not None else None
    reveal_full_address = existing_quotation is not None and existing_quotation.quotation_status_id == QUOTATION_STATUS_SELECTED

    quotation_url = None
    if company_id is not None:
        site_url = os.environ.get('SITE_URL', 'https://chalan.pe/')
        token = _generate_quotation_token(company_id, order_id)
        quotation_url = f"{site_url}quotation/{token}"

    customer = db.session.get(Customer, order.customer_id) if order.customer_id else None
    customer_name = None
    customer_phone = None
    images = None
    if is_admin:
        if customer:
            customer_name = ' '.join(filter(None, [customer.name, customer.paternal_last_name]))
            customer_phone = customer.mobile_phone
        images = [i.to_dict() for i in OrderImage.query.filter_by(order_id=order_id).all()]

    services = [s.to_dict() for s in OrdersService.query.filter_by(order_id=order_id).all()]

    return jsonify({
        'order': {
            **(order.to_dict_full() if is_admin else order.to_dict()),
            'origin': _address_payload(origin, is_admin, reveal_full_address),
            'destination': _address_payload(destination, is_admin, reveal_full_address),
            'quotation_url': quotation_url,
            'existing_quotation': existing_quotation.to_dict() if existing_quotation else None,
            'customer_name': customer_name,
            'customer_phone': customer_phone,
            'lead_phone': order.lead_phone if is_admin else None,
            'services': services,
            'images': images,
            'financials': _financial_breakdown(order) if is_admin else None,
        }
    }), 200


@api.route('/services', methods=['GET'])
@login_required
def list_services():
    """Catálogo de servicios contratables. El formulario de edición lo pide en
    vez de llevar los nombres escritos a mano, para que agregar una fila a
    lu_services no exija tocar el frontend."""
    services = LuService.query.order_by(LuService.id).all()
    return jsonify({'services': [
        {'id': s.id, 'name': s.service, 'description': s.description}
        for s in services
    ]}), 200


@api.route('/orders/<int:order_id>', methods=['PUT'])
@login_required
def update_order(order_id):
    user = g.current_user
    if user.role != ROLE_SUPERADMIN:
        return jsonify({'message': 'forbidden'}), 403

    order = Order.query.get(order_id)
    if order is None:
        return jsonify({'message': 'order not found'}), 404

    data = request.get_json() or {}

    if 'appointment_date' in data:
        from datetime import datetime as dt
        try:
            order.appointment_date = dt.fromisoformat(data['appointment_date']) if data['appointment_date'] else None
        except ValueError:
            return jsonify({'message': 'invalid appointment_date format'}), 400
    if 'order_status_id' in data:
        order.order_status_id = data['order_status_id']
    if 'approximate_budget' in data:
        order.approximate_budget = data['approximate_budget']
    if 'total_kilometers' in data:
        order.total_kilometers = data['total_kilometers']
    if 'comments' in data:
        order.comments = data['comments']
    if 'lead_phone' in data:
        order.lead_phone = data['lead_phone']
    if 'loaders_quantity' in data:
        order.loaders_quantity = data['loaders_quantity']
    if 'customer_id' in data:
        # Se comprueba que exista antes de asignar. La FK lo rechazaría igual,
        # pero como IntegrityError en el commit de más abajo: un 500 opaco,
        # después de haber aplicado el resto de los campos. Mejor un 404 claro
        # y sin escribir nada.
        new_customer_id = data['customer_id']
        if new_customer_id in (None, ''):
            order.customer_id = None
        else:
            customer = db.session.get(Customer, new_customer_id)
            if customer is None:
                return jsonify({'message': 'customer not found'}), 404
            order.customer_id = customer.id

    final_service_names = None
    if 'services' in data:
        # Lista completa de nombres, no un delta: lo que llega es el estado
        # final. Omitir la clave deja los servicios como estaban, igual que el
        # resto de campos de este endpoint.
        requested = data['services'] or []
        if not isinstance(requested, list):
            return jsonify({'message': 'services must be a list'}), 400

        catalog = {s.service: s.id for s in LuService.query.all()}
        unknown = [name for name in requested if name not in catalog]
        if unknown:
            return jsonify({'message': 'unknown services: ' + ', '.join(unknown)}), 400

        wanted = {catalog[name] for name in requested}
        current = OrdersService.query.filter_by(order_id=order_id).all()
        for row in current:
            if row.service_id not in wanted:
                db.session.delete(row)
        for service_id in wanted - {row.service_id for row in current}:
            db.session.add(OrdersService(order_id=order_id, service_id=service_id))
        final_service_names = set(requested)

    # `cargo` y `loaders_quantity` describen el mismo servicio desde dos lados y
    # tienen que cuadrar. Se corrige en vez de rechazar: 180 órdenes traen cargo
    # sin cantidad por ser anteriores a la migración 014, y un 400 dejaría esas
    # órdenes imposibles de editar. Es además lo que ya hace el flujo del
    # cliente en Step-two al marcar o desmarcar la casilla.
    #
    # Solo si la petición menciona alguno de los dos: sin esta guarda, editar
    # únicamente los comentarios de una orden histórica le inventaría un
    # cargador.
    if 'services' in data or 'loaders_quantity' in data:
        if final_service_names is None:
            final_service_names = {
                row.service.service
                for row in OrdersService.query.filter_by(order_id=order_id).all()
                if row.service
            }
        if 'cargo' not in final_service_names:
            order.loaders_quantity = None
        elif not order.loaders_quantity:
            order.loaders_quantity = 1

    for addr_type, key in [('carry_from', 'origin'), ('deliver_to', 'destination')]:
        addr_data = data.get(key)
        if addr_data is None:
            continue
        detail = OrderDetail.query.filter_by(order_id=order_id, type=addr_type).first()
        if detail is None:
            continue
        for field in ('street', 'country', 'floor_number', 'map_url',
                      'approximate_distance_from_parking'):
            if field in addr_data:
                setattr(detail, field, addr_data[field])
        if 'has_elevator' in addr_data:
            detail.has_elevator = int(bool(addr_data['has_elevator']))

    db.session.commit()

    details = list(order.order_details)
    origin = next((d for d in details if d.type == 'carry_from'), None)
    destination = next((d for d in details if d.type == 'deliver_to'), None)

    return jsonify({
        'order': {
            **order.to_dict_full(),
            'origin': origin.to_dict_full() if origin else None,
            'destination': destination.to_dict_full() if destination else None,
            'services': [s.to_dict() for s in
                         OrdersService.query.filter_by(order_id=order_id).all()],
        }
    }), 200


@api.route('/orders/<int:order_id>/complete', methods=['PATCH'])
@login_required
def complete_order(order_id):
    user = g.current_user
    if user.role != ROLE_CARRIER:
        return jsonify({'message': 'forbidden'}), 403

    order = Order.query.get(order_id)
    if order is None:
        return jsonify({'message': 'order not found'}), 404
    if order.order_status_id != 2:
        return jsonify({'message': 'order is not in progress'}), 409

    accepted = Quotation.query.filter_by(
        order_id=order_id,
        carrier_company_id=user.carrier_company_id,
        quotation_status_id=2,
    ).first()
    if accepted is None:
        return jsonify({'message': 'no accepted quotation for this order'}), 403

    order.order_status_id = 3
    db.session.commit()

    return jsonify({'order_id': order_id, 'order_status_id': 3}), 200


@api.route('/orders/<int:order_id>/quotation-links', methods=['GET'])
@login_required
def get_quotation_links(order_id):
    user = g.current_user
    if user.role not in (ROLE_SUPERADMIN, ROLE_ADMIN):
        return jsonify({'message': 'forbidden'}), 403

    order = db.session.get(Order, order_id)
    if order is None:
        return jsonify({'message': 'order not found'}), 404

    companies = CarrierCompany.query.filter_by(active=1).order_by(CarrierCompany.name).all()

    result = []
    for company in companies:
        token = _generate_quotation_token(company.id, order_id)
        result.append({
            'id': company.id,
            'name': company.name,
            'token': token,
        })

    return jsonify({'companies': result}), 200


@api.route('/orders/<int:order_id>/review-link', methods=['GET'])
@login_required
def get_review_link(order_id):
    user = g.current_user
    if user.role not in (ROLE_SUPERADMIN, ROLE_ADMIN):
        return jsonify({'message': 'forbidden'}), 403

    order = db.session.get(Order, order_id)
    if order is None:
        return jsonify({'message': 'order not found'}), 404
    if order.order_status_id != 3:
        return jsonify({'message': 'order is not completed'}), 400
    if not order.customer_id:
        return jsonify({'message': 'order has no customer'}), 400

    selected_quotation = Quotation.query.filter_by(order_id=order_id, quotation_status_id=2).first()
    if selected_quotation is None:
        return jsonify({'message': 'order has no selected quotation'}), 400

    token = _generate_review_token(order_id, order.customer_id, selected_quotation.carrier_company_id)
    return jsonify({'token': token}), 200


@api.route('/orders/<int:order_id>/quotations', methods=['GET'])
@login_required
def list_order_quotations(order_id):
    user = g.current_user
    if user.role not in (ROLE_SUPERADMIN, ROLE_ADMIN):
        return jsonify({'message': 'forbidden'}), 403

    order = db.session.get(Order, order_id)
    if order is None:
        return jsonify({'message': 'order not found'}), 404

    platform_fee = float(os.environ.get('PLATFORM_FEE', 0.1))
    commission_rate = 0
    referred = ReferredOrder.query.filter_by(order_id=order_id).first()
    if referred:
        from ..models import AdminUser
        agent = db.session.get(AdminUser, referred.admin_user_id)
        if agent:
            commission_rate = agent.commission_rate

    quotations = order.quotations.order_by(Quotation.created_date.asc()).all()

    result = []
    for q in quotations:
        company = db.session.get(CarrierCompany, q.carrier_company_id) if q.carrier_company_id else None
        total_amount = round(q.amount * (1 + commission_rate + platform_fee), 2) if q.amount else None
        result.append({
            **q.to_dict(),
            'carrier_company_name': company.name if company else None,
            'total_amount': total_amount,
        })

    return jsonify({
        'quotations': result,
        'commission_rate': commission_rate,
        'platform_fee': platform_fee,
        'order_status_id': order.order_status_id,
    }), 200


@api.route('/orders/<int:order_id>/quotations/<int:quotation_id>', methods=['PATCH'])
@login_required
def update_quotation_amount(order_id, quotation_id):
    user = g.current_user
    if user.role not in (ROLE_SUPERADMIN, ROLE_ADMIN):
        return jsonify({'message': 'forbidden'}), 403

    quotation = Quotation.query.filter_by(id=quotation_id, order_id=order_id).first()
    if quotation is None:
        return jsonify({'message': 'quotation not found'}), 404
    if quotation.quotation_status_id == 2:
        return jsonify({'message': 'selected quotations cannot be edited'}), 409
    order = db.session.get(Order, order_id)
    if order and order.order_status_id == 2:
        return jsonify({'message': 'quotations for in-progress orders cannot be edited'}), 409

    data = request.get_json() or {}
    new_amount = data.get('amount')
    if new_amount is None or float(new_amount) <= 0:
        return jsonify({'message': 'invalid amount'}), 400

    platform_fee = float(os.environ.get('PLATFORM_FEE', 0.1))
    commission_rate = 0
    referred = ReferredOrder.query.filter_by(order_id=order_id).first()
    if referred:
        from ..models import AdminUser
        agent = db.session.get(AdminUser, referred.admin_user_id)
        if agent:
            commission_rate = agent.commission_rate

    quotation.amount = float(new_amount)
    db.session.commit()

    total_amount = round(quotation.amount * (1 + commission_rate + platform_fee), 2)
    agent_commission = round(quotation.amount * commission_rate, 2)
    chalan_fee = round(quotation.amount * platform_fee, 2)

    return jsonify({
        **quotation.to_dict(),
        'total_amount': total_amount,
        'agent_commission': agent_commission,
        'chalan_fee': chalan_fee,
    }), 200


@api.route('/orders/<int:order_id>/quotations/<int:quotation_id>/accept', methods=['PATCH'])
@login_required
def accept_quotation(order_id, quotation_id):
    """Accepts a quotation on behalf of the customer - for cases where the
    customer arranged it directly with the carrier (phone/WhatsApp) instead
    of picking it themselves in the site, since there's no customer
    impersonation. Proxies to the main API's own pick-quotation logic
    server-to-server rather than reimplementing it here, so the two never
    drift apart (same pattern as create_order/upload_order_image above)."""
    user = g.current_user
    if user.role != ROLE_SUPERADMIN:
        return jsonify({'message': 'forbidden'}), 403

    internal_api = os.getenv('INTERNAL_API_URL', 'http://flask-api:8001')
    try:
        res = requests.patch(
            f'{internal_api}/api/v1/order/{order_id}/quotation/{quotation_id}/accept',
            timeout=10,
        )
    except requests.RequestException:
        return jsonify({'message': 'could not reach the quotation service'}), 502
    if res.status_code != 200:
        try:
            message = res.json().get('message', 'failed to accept quotation')
        except ValueError:
            message = 'failed to accept quotation'
        return jsonify({'message': message}), res.status_code if res.status_code in (404, 409) else 502

    return jsonify(res.json()), 200


@api.route('/orders/<int:order_id>/payments', methods=['GET'])
@login_required
def list_order_payments(order_id):
    """Movimientos de plata de la orden. Solo admin: el transportista no tiene
    por qué ver cuánto se llevó Chalán ni el agente."""
    if g.current_user.role not in (ROLE_SUPERADMIN, ROLE_ADMIN):
        return jsonify({'message': 'forbidden'}), 403

    payments = Payment.query.filter_by(order_id=order_id)\
        .order_by(Payment.id.asc()).all()
    return jsonify({'payments': [p.to_dict() for p in payments]}), 200


@api.route('/orders/<int:order_id>/payments/<int:payment_id>', methods=['PATCH'])
@login_required
def update_order_payment(order_id, payment_id):
    """Marca un movimiento como pagado o cancelado.

    Existe porque Yape personal no tiene webhook: alguien ve el yapeo en su
    celular y lo confirma a mano. Queda sellado quién y cuándo.
    """
    if g.current_user.role not in (ROLE_SUPERADMIN, ROLE_ADMIN):
        return jsonify({'message': 'forbidden'}), 403

    payment = Payment.query.filter_by(id=payment_id, order_id=order_id).first()
    if payment is None:
        return jsonify({'message': 'payment not found'}), 404

    data = request.get_json() or {}
    new_status = (data.get('status') or '').strip()
    if new_status not in ('pending', 'paid', 'cancelled'):
        return jsonify({'message': 'invalid status'}), 400

    payment.status = new_status
    if new_status == 'paid':
        payment.paid_at = datetime.now(timezone.utc)
        payment.confirmed_by_admin_id = g.current_user.id
    else:
        # Al revertir se borra el sello: dejarlo mentiría sobre una
        # confirmación que ya no está vigente.
        payment.paid_at = None
        payment.confirmed_by_admin_id = None

    reference = data.get('reference')
    if reference is not None:
        payment.reference = str(reference).strip()[:100] or None

    db.session.commit()
    return jsonify({'payment': payment.to_dict()}), 200


@api.route('/referred-orders', methods=['GET'])
@login_required
def list_referred_orders():
    """Orders referred by the current real_estate_agent user."""
    user = g.current_user
    if user.role == ROLE_REAL_ESTATE:
        refs = ReferredOrder.query.filter_by(admin_user_id=user.id)\
            .order_by(ReferredOrder.created_date.desc()).all()
    elif user.role in (ROLE_SUPERADMIN, ROLE_ADMIN):
        refs = ReferredOrder.query.order_by(ReferredOrder.created_date.desc()).all()
    else:
        return jsonify({'message': 'forbidden'}), 403

    # Status 3=completed, 4=cancelled
    EXCLUDED_STATUSES = (3, 4)

    result = []
    commission_balance = 0
    for ref in refs:
        order = db.session.get(Order, ref.order_id)
        if order is None:
            continue
        details = list(order.order_details)
        origin = next((d for d in details if d.type == 'carry_from'), None)
        destination = next((d for d in details if d.type == 'deliver_to'), None)
        customer = db.session.get(Customer, order.customer_id) if order.customer_id else None
        customer_name = None
        if customer:
            customer_name = ' '.join(filter(None, [customer.name, customer.paternal_last_name]))

        result.append({
            **order.to_dict(),
            'referred_by': ref.admin_user_id,
            'referred_date': ref.created_date.isoformat() + '+00:00' if ref.created_date else None,
            'commission': ref.commission,
            'origin': origin.to_dict() if origin else None,
            'destination': destination.to_dict() if destination else None,
            'customer_name': customer_name,
        })
        if order.order_status_id not in EXCLUDED_STATUSES:
            commission_balance += ref.commission or 0

    return jsonify({'orders': result, 'commission_balance': commission_balance}), 200


@api.route('/admin/referred-orders', methods=['GET'])
@login_required
def admin_list_referred_orders():
    """All referred orders with agent details — admin/superadmin only."""
    user = g.current_user
    if user.role not in (ROLE_SUPERADMIN, ROLE_ADMIN):
        return jsonify({'message': 'forbidden'}), 403

    refs = ReferredOrder.query.order_by(ReferredOrder.created_date.desc()).all()

    result = []
    total_commission = 0
    for ref in refs:
        order = db.session.get(Order, ref.order_id)
        if order is None:
            continue
        details = list(order.order_details)
        origin = next((d for d in details if d.type == 'carry_from'), None)
        destination = next((d for d in details if d.type == 'deliver_to'), None)
        customer = db.session.get(Customer, order.customer_id) if order.customer_id else None
        customer_name = None
        if customer:
            customer_name = ' '.join(filter(None, [customer.name, customer.paternal_last_name]))

        from ..models import AdminUser
        agent = db.session.get(AdminUser, ref.admin_user_id)
        agent_name = ' '.join(filter(None, [agent.first_name, agent.last_name])) if agent else None

        result.append({
            **order.to_dict(),
            'total_amount': order.total_amount,
            'referred_by': ref.admin_user_id,
            'agent_name': agent_name,
            'agent_email': agent.email if agent else None,
            'commission_rate': agent.commission_rate if agent else None,
            'referred_date': ref.created_date.isoformat() + '+00:00' if ref.created_date else None,
            'commission': ref.commission,
            'origin': origin.to_dict() if origin else None,
            'destination': destination.to_dict() if destination else None,
            'customer_name': customer_name,
        })
        total_commission += ref.commission or 0

    return jsonify({'orders': result, 'total_commission': total_commission}), 200


@api.route('/referred-orders', methods=['POST'])
@login_required
def create_referred_order():
    """Assign an order to a real_estate_agent."""
    user = g.current_user
    if user.role not in (ROLE_SUPERADMIN, ROLE_ADMIN):
        return jsonify({'message': 'admin access required'}), 403

    data = request.get_json()
    if not data or not data.get('admin_user_id') or not data.get('order_id'):
        return jsonify({'message': 'admin_user_id and order_id are required'}), 400

    from ..models import AdminUser
    agent = db.session.get(AdminUser, data['admin_user_id'])
    if agent is None or agent.role != ROLE_REAL_ESTATE:
        return jsonify({'message': 'agent not found or not a real_estate_agent'}), 404

    order = db.session.get(Order, data['order_id'])
    if order is None:
        return jsonify({'message': 'order not found'}), 404

    existing = ReferredOrder.query.filter_by(
        admin_user_id=data['admin_user_id'], order_id=data['order_id']
    ).first()
    if existing:
        return jsonify({'message': 'order already referred to this agent'}), 409

    ref = ReferredOrder(admin_user_id=data['admin_user_id'], order_id=data['order_id'])
    db.session.add(ref)
    db.session.commit()

    return jsonify({'referred_order': ref.to_dict()}), 201
