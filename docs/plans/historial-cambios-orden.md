# Plan: historial de cambios de la orden y diff para transportistas

> Plan para implementar. Alcance: **órdenes de mudanza y flete de Perú** (tablas `orders`,
> `order_details`). No toca solicitudes de servicios (`service_requests`) ni nada de chalan.mx.
> Antes de cada paso, releer el código citado: los números de línea pueden haber cambiado.
> Escrito el 2026-11-15 sobre el commit `fb401bb`.

## 1. Objetivo

Hoy, cuando el cliente cambia su mudanza después de enviarla a transportistas (día, cosas,
direcciones...), el `PUT` reescribe la orden y lo anterior se pierde. El transportista recibe
"La orden cambió, vuelve a cotizar" con el link y tiene que adivinar qué cambió.

Se quiere:

1. **Guardar cada versión de la orden** desde que se envía a transportistas, como commits.
2. **Mostrar al transportista un diff tipo git** de lo que cambió desde que cotizó (o desde que
   se le envió, si no cotizó): antes → después, y la lista de cosas línea por línea con `+` / `−`.
3. **Mostrar a los admins el historial completo** en el detalle de la orden, con quién hizo cada
   cambio y qué cotizaciones quedaron hechas sobre una versión anterior.

### Decisiones tomadas

Las tres primeras las confirmó Carlos el 2026-11-15. Ninguna se reabre.

- **El historial empieza en el primer aviso a transportistas.** Lo de antes es borrador: nadie
  lo vio y solo mete ruido. La versión 1 es lo que se envió.
- **El transportista que nunca cotizó también ve los cambios**, contra la versión 1.
- **No se cambia cuándo se cancelan cotizaciones ni cuándo se avisa.** Eso es la fase 4, que
  queda para después (ver §6).
- **Versiones completas (una foto JSON por cambio), no un log campo por campo.** El diff entre
  dos versiones cualesquiera se calcula al leer; con un log, A → B → A obliga a colapsar.
- **El diff y sus textos se arman en un solo lugar, el API principal.** Cada entrada ya viene
  con su etiqueta y sus valores escritos en español. Vue, backoffice y el correo solo pintan.
  No crear copias de etiquetas en JS: este repo ya tiene demasiados "cambiar los dos juntos".
- **El backoffice-api no calcula nada**: pide el diff al API principal por ruta interna, como
  hace con videos, fotos de vehículo, etc.
- **Sin agrupar ni enmendar versiones.** Un cliente que pasa por el paso 1 y el paso 2 deja dos
  versiones seguidas; no importa, porque al transportista se le muestra el diff neto.
- **La plantilla de WhatsApp no cambia** (agregarle una variable pide aprobación de Meta).

## 2. Contexto del código actual (leer antes de empezar)

### Cómo se escribe una orden: tres caminos

1. **`PUT /api/v1/order/<id>`** → `update_order` en `app/api/orders.py`. Lo usan los pasos 1 y 2
   de Vue, el "crear orden" del backoffice (`backoffice-api/app/api/orders.py`, llamada interna)
   y el agente de cotizaciones. Solo escribe datos cuando el cuerpo trae
   `orderEditedByCustomer` (`written == 'full'`, vía `OrderEntity.update` en
   `app/api/order/order.py`); los demás PUT solo ligan al cliente (`link_customer`).
2. **`PUT /backoffice-api/api/orders/<id>`** → `update_order` en
   `backoffice-api/app/api/orders.py` (superadmin, `pages/orders/Edit.jsx`). **Escribe directo a
   la base**, sin pasar por el API principal. Después `Edit.jsx` sube fotos, luego videos, y al
   final llama a `notify-carriers` si se marcó "Guardar y enviar".
3. **Fotos y videos**: `POST /api/v1/order/recognize-items` (crea `OrderImage`),
   `DELETE /api/v1/order/<id>/image/<image_id>`, y `register_order_video` /
   `delete_order_video` en `app/api/order_videos.py`.

### Cómo se avisa

- `send_email_to_carrier_companies` (`app/api/orders.py`) manda correo + WhatsApp a las empresas
  de `get_carrier_companies()` que no tienen cotización viva, y pone
  `quotation_requested = True` y `carrier_notified_at = utcnow()`. Asunto "La orden cambió,
  vuelve a cotizar Chalán" cuando la empresa ya había cotizado antes (`had_previous_quotation`).
- En `update_order`, si `orderEditedByCustomer` y `data_changed`: fuera del
  `CARRIER_NOTIFICATION_COOLDOWN` (15 min desde el último aviso) cancela las cotizaciones vivas
  y pone `quotation_requested = False`, así el paso 3 vuelve a avisar.
- `notify_carriers` (`POST /api/v1/order/<id>/notify-carriers`, interna) es el envío a pedido
  del backoffice.

### Dos huecos que este plan hace visibles (no los arregla)

- `has_changed` (`app/api/order/steps/addresses.py` y `belongings_appointment_date.py`) solo
  mira calle, piso, país, `map_url`, fecha, cosas, embalaje y carga. Un cambio solo de ascensor,
  distancia al estacionamiento, interior, tipo de carga, peso, cargadores o presupuesto no
  cancela ni avisa.
- Un cambio dentro de los 15 minutos del aviso tampoco: la cotización ya hecha sigue viva sobre
  otra mudanza.

Con el historial, esas cotizaciones quedan marcadas "cotizó antes del último cambio" para el
admin, y el transportista ve el diff si abre la orden.

### Qué ve hoy el transportista

- **Link de Vue** (`frontend/src/views/carrier-company/quotation.vue` y `order-details.vue`):
  `GET /api/v1/orders/details` → `order_detail` en `app/api/orders.py`. Devuelve solo
  `CARRIER_ORDER_FIELDS`, su propia cotización, el presupuesto **sin** comisión
  (dividido entre `1 + commission_rate + PLATFORM_FEE`) y la dirección completa, salvo que se
  haya elegido a otra empresa (calle sin número, sin mapa).
- **Backoffice** (`backoffice/src/pages/orders/Detail.jsx`, rol `carrier_company`):
  `GET /backoffice-api/api/orders/<id>` → `get_order`. La dirección pasa por
  `_address_payload`: **solo el distrito** (`district_of`) más piso, ascensor y distancia al
  estacionamiento, hasta que la mudanza es suya (`_is_theirs`). `_may_quote` decide si todavía
  puede cotizar.
- Las recotizaciones actualizan la misma fila (`create_quotation` en `app/api/quotations.py`,
  rama "Recotización sobre una cotización activa"). `QuotationEntity.get` no ve las canceladas.

### Convenciones

- Migraciones: SQL crudo con `IF NOT EXISTS`, numeradas; la última es `050`. **Toda tabla nueva
  activa RLS en su migración.** Ver `048_auto_quote_estimates.py` como modelo.
- Columnas JSON: `db.Column(db.JSON)` en el modelo (los tests corren en SQLite), `JSONB` en la
  migración.
- Llamadas internas backoffice-api → API principal: `_internal_headers()` e
  `INTERNAL_API_URL`; del otro lado `is_internal_request()` (`app/api/decorators.py`).
- Tests: `tests/` (API principal) y `backoffice-api/tests/`, con pytest dentro de los
  contenedores (`docker-compose -f docker-compose.local.yml exec -T flask python -m pytest -q`,
  ídem `backoffice-api`). **No correr la suite e2e de Playwright** salvo que Carlos lo pida.
- Tailwind del Vue: 3.4 con la paleta de la v1 (`frontend/tailwind.config.js`). Hay `red-100`…,
  `green-50/100`…, `yellow-100`…, `gray-50`. No armar nombres de clase por concatenación.

## 3. Diseño

### 3.1 Migración `051_order_versions.py`

```sql
CREATE TABLE IF NOT EXISTS order_versions (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    author VARCHAR(20) NOT NULL,            -- 'customer' | 'admin'
    admin_user_id INTEGER NULL,             -- quién, cuando author = 'admin' y se sabe
    snapshot JSONB NOT NULL,
    notified_at TIMESTAMP NULL,             -- esta versión se avisó a transportistas
    created_date TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (order_id, number)
);
ALTER TABLE order_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS order_version_id INTEGER NULL
    REFERENCES order_versions(id) ON DELETE SET NULL;
```

Modelo `OrderVersion` en `app/models.py` y `order_version_id` en `Quotations`.
`QuotationsSchema` tiene `fields` explícitos, así que la columna nueva no sale sola a nadie:
dejarlo así.

### 3.2 Módulo nuevo `app/api/order/versions.py`

Python plano sobre los modelos. Todo lo que sigue vive aquí.

**`build_snapshot(order)`** — la foto. Siempre las mismas claves, solo tipos JSON:

```python
{
  'appointment_date': '2026-11-14 09:00:00' | None,   # strftime fijo
  'load_type': 'moving' | 'items' | 'cargo' | 'vehicle' | None,
  'cargo_weight_kg': int | None,
  'comments': str,            # '\r\n' -> '\n', sin espacios al final de cada línea
  'loaders_quantity': int | None,
  'approximate_budget': float,            # como está guardado (con comisión)
  'services': ['cargo', 'packaging'],     # nombres de lu_services, ordenados
  'origin': {...}, 'destination': {...},  # carry_from / deliver_to
  'images': [id, ...], 'videos': [id, ...],   # ids ordenados
}
```

Cada dirección: `street`, `interior_number`, `floor_number`, `has_elevator` (bool),
`approximate_distance_from_parking`, `map_url`, `neighborhood`, `city`, `state`, `zip_code`,
`country`, `latitude`, `longitude` (redondeadas a 6 decimales). Normalizar bien: dos fotos del
mismo estado tienen que ser iguales con `==` después de ir y volver de la base.

**`record_version(order_id, author, admin_user_id=None, notified=False)`**

1. Si la orden no tiene `carrier_notified_at` y `notified` es falso → no hace nada (borrador).
2. Arma la foto y la compara con la de la última versión.
   - Igual: si `notified`, pone `notified_at = utcnow()` en esa versión. No crea otra.
   - Distinta (o no hay ninguna): inserta con `number = último + 1` y, si `notified`,
     `notified_at`.
3. Hace commit y devuelve la versión vigente.

No debe romper la ruta que la llama: envolver en `try/except`, registrar con
`current_app.logger.exception` y hacer `rollback`. Perder una versión es mejor que un 500 al
guardar una mudanza.

**`current_version(order_id)`** — la última, o `None`.

**`diff_snapshots(before, after, services_catalog)`** — lista de entradas, en este orden:

| `field` | `label` | `kind` | Valores |
|---|---|---|---|
| `appointment_date` | Fecha | `value` | "sáb 14 nov, 9:00 am" (nombres en español con tablas propias, sin depender del locale) |
| `load_type` | Qué lleva | `value` | etiquetas de `frontend/src/utils/loadTypes.js`; agregarlas a `app/api/order/load.py` |
| `cargo_weight_kg` | Peso | `value` | la etiqueta del rango, de la misma lista |
| `comments` | Cosas | `lines` | `lines: [{op: '=' \| '-' \| '+', text}]` con `difflib.SequenceMatcher` sobre las líneas no vacías |
| `loaders_quantity` | Cargadores | `value` | número, o "Sin cargadores" |
| `approximate_budget` | Presupuesto | `value` | "S/ 300" |
| `services` | Servicios | `list` | `added` / `removed` con la `description` de `lu_services` |
| `origin.street` / `destination.street` | Origen / Destino | `value` | el texto de la calle |
| `origin.location` / … | Origen: punto en el mapa | `value` | solo si la calle es igual y cambió `map_url` o las coordenadas: `after` = "El cliente movió el punto en el mapa", sin `before` |
| `origin.interior_number` / … | Interior (origen) | `value` | |
| `origin.floor_number` / … | Piso (origen) | `value` | |
| `origin.has_elevator` / … | Ascensor (origen) | `value` | "Sí" / "No" |
| `origin.approximate_distance_from_parking` / … | Distancia al estacionamiento (origen) | `value` | con la misma unidad y redacción que `quotation.vue` |
| `images` / `videos` | Fotos / Videos | `value` | "3 fotos" → "5 fotos" |

`neighborhood`, `city`, `state`, `zip_code` y `country` no generan entradas propias: salen del
lugar elegido y cambian junto con la calle. Un valor vacío se escribe "Sin dato", no `null`.
Forma de una entrada: `{field, label, kind, before, after}` (o `lines`, o `added`/`removed`).

**`for_carrier(entries, order, before, after, address)`** — lo que puede ver una empresa:

- `approximate_budget`: los dos valores divididos entre `1 + commission_rate + PLATFORM_FEE`,
  con la misma cuenta que hoy hace `order_detail`. Sacar esa cuenta a una función y usarla en
  los dos lugares.
- `address == 'full'`: tal cual.
- `address == 'district'`: `*.street` pasa a ser el distrito de antes y de después
  (`district_of` de `app/api/address.py`, sobre la dirección completa de cada foto). Si el
  distrito es el mismo, `before` vacío y `after` = "Cambió la dirección (sigue en Lince)". Se
  quitan `*.interior_number` y `*.location`. Piso, ascensor y estacionamiento quedan: el
  backoffice ya se los muestra.

**`changes_for_carrier(order, carrier_company_id, address)`** — el objeto que reciben las
vistas, o `None`:

- `None` si la orden no tiene versiones, o si la orden no está pendiente y la cotización
  elegida no es de esta empresa (a quien perdió no se le muestra nada).
- **Base**: la última cotización de la empresa en la orden, **canceladas incluidas**
  (`order by updated_date desc, id desc`). Si tiene `order_version_id`, esa versión. Si no
  tiene (cotización anterior a este feature) o nunca cotizó, la versión 1.
- `None` si el diff entre la base y la versión vigente queda vacío.

```json
{
  "since": "quotation",              // o "sent" si nunca cotizó
  "since_date": "2026-11-12T20:40:00+00:00",
  "changed_at": "2026-11-13T15:02:00+00:00",
  "entries": [ ... ],
  "history": [ { "number": 2, "created_date": "...", "author": "customer", "entries": [ ... ] } ]
}
```

`history`: cada versión posterior a la base, con su diff contra la anterior y el mismo filtro.
`author` es solo `customer` o `chalan`: nunca el nombre ni el id del admin.

**`history_for_admin(order)`** — todas las versiones, cada una con `number`, `created_date`,
`author`, `admin_user_id`, `notified_at` y `entries` contra la anterior (sin filtrar, con el
presupuesto como está guardado), más
`quotations: [{id, carrier_company_id, carrier_company_name, quotation_status_id, amount, version_number}]`
y `current_number`.

## 4. Fases

Cada fase se puede desplegar sola. Un commit por fase, como mínimo.

### Fase 1 — Guardar las versiones y verlas como admin

> **Hecha el 2026-11-15.** Diferencias con lo escrito abajo: `for_carrier` y
> `changes_for_carrier` (§3.2) no se escribieron, porque recién los usa la fase 2. Una versión
> nueva se crea cuando cambia lo que se ve (`diff_snapshots` no vacío), no cuando cambia la foto
> en cualquier campo: así no quedan versiones vacías por un `city` que cambió solo. Las fotos y
> videos que sube el backoffice quedan como autor `admin` pero sin `admin_user_id`. `comments`
> se guarda sin líneas vacías ni espacios a los costados. El punto del mapa dice "Se movió el
> punto en el mapa" (no "El cliente movió...": también lo puede mover un admin). El backfill
> pone `author = 'customer'` (no se sabe quién) y el backoffice no muestra autor en la versión 1.

**1.1 Migración y modelos** (§3.1) y el módulo de §3.2 con sus tests.

**1.2 Registrar en el API principal** (`app/api/orders.py`, `app/api/order_videos.py`):

- `update_order`: justo después de `order_entity.update(...)` (cuando `written == 'full'`),
  `record_version(order_id, 'admin' if internal else 'customer')`. Tiene que ir **antes** del
  bloque que cancela cotizaciones y de `send_email_to_carrier_companies`.
- `send_email_to_carrier_companies`: donde pone `quotation_requested = True` y
  `carrier_notified_at`, después del commit, `record_version(order_id, autor, notified=True)`
  con `autor = 'admin' if is_internal_request() else 'customer'`. En el primer aviso esto crea
  la versión 1; en los siguientes solo sella `notified_at`.
- Al final de `recognize_items` (cuando guardó la foto), `delete_order_image`,
  `register_order_video` y `delete_order_video`: `record_version(...)` con el mismo criterio de
  autor. En una orden que todavía no se envió no hace nada.

**1.3 Sellar la cotización** (`app/api/quotations.py` → `create_quotation`,
`app/api/quotation/quotation.py` → `create`): al crear y al recotizar, guardar
`order_version_id = current_version(order_id).id` (o `None` si no hay). En la recotización va
dentro de `changes`.

**1.4 Rutas internas** en el API principal (403 sin `is_internal_request()`):

- `POST /api/v1/order/<id>/versions` `{admin_user_id}` → `record_version(id, 'admin', admin_user_id)`.
- `GET /api/v1/order/<id>/versions` → `history_for_admin`.

**1.5 Backoffice-api** (`backoffice-api/app/api/orders.py`):

- En `update_order` (el PUT del superadmin), después del commit final, llamar a
  `POST .../versions` con el id del admin. Si falla (red, 5xx), registrar y **seguir**: el
  guardado no puede fallar por esto.
- `GET /api/orders/<id>/changes`: para admin y superadmin reenvía `GET .../versions`. (El rol
  transportista se agrega en la fase 2.)

**1.6 Órdenes ya enviadas**: comando `flask order-versions-backfill` (sin `--apply` solo
cuenta, como `auto-quote-backfill`): crea la versión 1, con el estado de hoy y
`notified_at = carrier_notified_at`, para cada orden pendiente con `carrier_notified_at` y sin
versiones. Repetible.

**1.7 Backoffice** (`backoffice/src/components/OrderChanges.jsx`, nuevo, y `Detail.jsx`): card
"Historial de cambios" para admins, cerca de `AutoQuoteEstimates`, solo si hay más de una
versión. Cada versión: fecha, "el cliente" o "Chalán", "avisada a transportistas" si tiene
`notified_at`, y sus entradas. Arriba, si hay cotizaciones vivas con `version_number` menor que
`current_number`: "Cotizaron antes del último cambio: Empresa A (S/ 350), Empresa B (S/ 400)".
Usar `components/Card.jsx`. El pintado de una entrada (según `kind`) va en un componente
aparte, `OrderChangeEntries`, porque la fase 2 lo reutiliza.

**Cómo se pinta una entrada** (igual en backoffice y en Vue):

- `value`: etiqueta, y `before` tachado en rojo → `after` en verde. Sin `before`, solo `after`.
- `lines`: la lista entera en monoespaciado; `-` con fondo rojo claro, `+` con fondo verde
  claro, `=` en gris. Si hay más de 6 líneas `=` seguidas, dejar 2 de cada lado y "…".
- `list`: `+ Embalaje` en verde, `− Carga y descarga` en rojo.

**1.8 Tests**

`tests/test_order_versions.py` (API principal):

- Una orden que no se envió no tiene versiones aunque se edite.
- El primer aviso crea la versión 1 con `notified_at`.
- Un PUT con `orderEditedByCustomer` que cambia la fecha crea la versión 2; el diff trae
  `appointment_date` con los textos esperados.
- El mismo PUT repetido no crea otra versión. Un PUT sin `orderEditedByCustomer` tampoco.
- Cambiar solo el ascensor (que `has_changed` no mira) sí crea versión.
- `comments`: líneas agregadas y quitadas con sus `op`.
- Cotizar sella `order_version_id`; recotizar lo actualiza.
- Las dos rutas internas dan 403 sin token interno.
- Un error dentro de `record_version` no rompe el PUT (simularlo con monkeypatch).
- El backfill crea la versión 1 una sola vez.

`backoffice-api/tests/test_order_changes.py`: roles de `GET /api/orders/<id>/changes`; el PUT
del superadmin llama a `POST .../versions` (mock de `requests`, como los otros tests de
reenvío); si esa llamada falla el PUT igual responde 200.

### Fase 2 — Lo que ve el transportista

> **Hecha el 2026-11-15.** Diferencias con lo escrito abajo: `changes_for_carrier(order_id, ...)` y
> `for_carrier(entries, order_id, ...)` reciben el id, no la orden. Tampoco se muestra nada si ya
> hay una cotización elegida de otra empresa aunque la orden siga pendiente (el yapeo en
> revisión), igual que la dirección del link. Un presupuesto que sin la comisión da lo mismo no
> es cambio. "Ver historial" solo aparece con más de un cambio desde la base. La etiqueta
> "Cambió" usa un modelo espejo `OrderVersion` en el backoffice-api, completo (no SQL suelto):
> los tests de SQLite no tendrían la tabla, y `create_all()` corre al arrancar.

**2.1 API principal**: `order_detail` agrega `changes` al JSON (junto a `order` y `decline`):
`changes_for_carrier(order, company_id, 'full')`. Ruta interna
`GET /api/v1/order/<id>/changes?carrier_company_id=&address=full|district` con lo mismo.

**2.2 Backoffice-api**: `GET /api/orders/<id>/changes` para el rol transportista: si
`_may_quote` es falso, `{'changes': None}`; si no, reenvía con su `carrier_company_id` y
`address=full` cuando `_is_theirs`, `district` en otro caso. Pasar por
`_carrier_without_moves` como `get_order`.

**2.3 Vue**: componente `frontend/src/components/carrierCompany/OrderChanges.vue`, usado por
`quotation.vue` y `order-details.vue`, arriba de los datos de la orden. Recuadro amarillo:

- Título: "Esta orden cambió después de tu cotización" (`since: quotation`) o "Esta orden
  cambió desde que te la enviamos" (`since: sent`), con la fecha de `changed_at`.
- Las entradas de `entries`.
- Si tiene cotización viva: "Revisa tu precio y vuelve a enviarlo si cambia."
- "Ver historial" plegado, con `history`.

Sin `changes` no se pinta nada.

**2.4 Backoffice**: el mismo recuadro para el transportista en `Detail.jsx`, arriba, con
`OrderChangeEntries` de la fase 1.

**2.5 Etiqueta "Cambió" en la lista del transportista** (`list_orders` del backoffice-api y
`pages/orders/List.jsx`): una orden la lleva cuando su última versión tiene un número mayor que
el de la versión de la última cotización de esa empresa (o mayor que 1 si no cotizó). Con SQL
directo (`db.session.execute(text(...))`, una consulta para toda la página), sin modelo espejo.
Es lo último de la fase: si se complica, dejarlo fuera y avisar.

**2.6 Tests** (agregar a los dos archivos de la fase 1):

- Base = versión de su cotización: cotiza en v1, el cliente cambia, ve el diff; recotiza y
  `changes` vuelve a `None`.
- Con la cotización cancelada por el cambio, la base sigue siendo la versión en que cotizó.
- Nunca cotizó: `since: sent`, contra la versión 1.
- Presupuesto sin comisión en las entradas, también en una orden referida.
- `address=district`: ninguna entrada trae la calle ni el interior; mismo distrito da el texto
  "sigue en …". Recorrer el JSON entero buscando la calle, no solo el campo esperado.
- Elegida otra empresa: `changes` es `None`.
- `history` no trae `admin_user_id` ni otro autor que `customer` / `chalan`.
- Backoffice-api: manda `district` antes de que sea suya y `full` después; otra empresa no
  puede pedir la de una orden ajena con otro `carrier_company_id`.

### Fase 3 — El correo dice qué cambió

En `send_email_to_carrier_companies`, cuando `had_previous_quotation`: calcular
`changes_for_carrier(order, company_id, 'district')` y pasarlo a
`app/templates/email/ask_for_quotation.html`, que lo pinta como lista simple sobre el botón
(sin colores que dependan de CSS externo: `<del>` y `<strong>`). Nivel `district` porque un
correo se reenvía. Sin cambios que mostrar, el correo queda como hoy. El WhatsApp no cambia.

Ojo con el orden: en ese punto la versión nueva ya tiene que existir (la crea el
`record_version` de `update_order`, que corre antes).

Test: el correo de "La orden cambió" recibe las entradas; el de una orden nueva no.

## 5. Al terminar cada fase

- Tests de los dos APIs en verde (comandos en §2). `npm run build` en `frontend/` y
  `backoffice/` si se tocaron. No correr e2e.
- Agregar a `CLAUDE.md` una sección "Order Change History" con el estilo de las demás (qué
  tabla, dónde se registra, quién ve qué, las reglas de privacidad), y agregar `changes` a la
  nota de `CARRIER_ORDER_FIELDS`.
- Commits en inglés con el estilo del `git log` (una frase larga que explica qué y por qué).
  **No hacer push ni desplegar**: Carlos lo pide aparte.
- Para el deploy: la migración 051 solo agrega una tabla y una columna nula, así que el código
  viejo sigue funcionando mientras corre. Después del deploy de la fase 1, correr en el
  contenedor `flask-api`: `flask order-versions-backfill` y luego con `--apply`.
- **Cómo se mide**: en la base, cotizaciones con `order_version_id` mayor que la versión 1 de
  su orden (recotizaciones tras un cambio) contra órdenes con más de una versión.

## 6. Fuera de alcance (no implementar)

- **Fase 4: decidir con el diff cuándo recotizar.** Reemplazar `has_changed` por la comparación
  de fotos (cubriría ascensor, tipo de carga, peso...) y resolver la ventana de 15 minutos.
  Cambia cuándo se cancelan cotizaciones: Carlos la dejó para después (2026-11-15), una vez
  que haya datos reales de las fases 1 y 2.
- Mostrarle el historial al cliente.
- Historial de solicitudes de servicios.
- Cambiar la plantilla de WhatsApp o agregar avisos nuevos.
- Agrupar versiones cercanas, revertir a una versión anterior, o editar el historial.
- Guardar el nombre del admin en lo que ve el transportista.
