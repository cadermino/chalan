# Plan: solicitudes de servicios (embalaje) — mini app React en chalán.pe/embalaje/cotizar

> Plan para implementar. Alcance: **Perú solamente** (no tocar nada de chalan.mx: ni
> `nginx.chalan-prod.conf`, ni `Dockerfile.nginx.prod`, ni `docker-compose.prod.yml`).

## 1. Objetivo y alcance

Hoy el embalaje se cotiza a mano: el cliente escribe por WhatsApp, el admin junta los datos
y se los reenvía a los transportistas. Se automatiza hasta este punto:

1. El cliente llena un formulario de 3 pasos en `https://chalan.pe/embalaje/cotizar`.
2. Se guarda una **solicitud de servicio** (tabla nueva, independiente de `orders`).
3. Al enviarla, cada transportista que ofrece ese servicio recibe email + WhatsApp con un
   **link al backoffice** (`/backoffice/carrier-view/<token>`) donde ve los datos que necesita
   para cotizar. El admin recibe un aviso con el link al detalle en el backoffice.

**Fuera de alcance (no implementar):** que el transportista cotice dentro de la plataforma,
que el cliente elija cotización, pagos, comisiones de referidos, cuentas de cliente, y avisar
al cliente por WhatsApp. El transportista sigue respondiendo su precio por WhatsApp a Chalán.

### Decisiones ya tomadas (no reabrir)

- **Tabla nueva**, separada de `orders`. Es genérica (`service_requests` + catálogo
  `lu_service_types`); embalaje (`packing`) es el primer tipo. Los campos propios de cada
  servicio van en una columna JSON `details`.
- **Sin cuenta de cliente.** Solo se pide un WhatsApp, que queda guardado en la solicitud.
  No se crea ni se liga ningún `customers`.
- **Mini app nueva Vite + React** (mismo stack que `backoffice/`), servida como estático por
  nginx. Sin Next.js.
- Datos que se piden: (1) dirección donde hay que ir a embalar, (2) lista de cosas a embalar,
  **cada item con sus propios checkboxes de materiales** (cartón, film, alfombra, caja de cartón,
  caja de madera), (3) fotos/videos opcionales, (4) fecha deseada, (5) WhatsApp.
- Los materiales salen de una **tabla catálogo** (`lu_service_materials`): agregar uno nuevo es
  insertar una fila, sin tocar código.
- **Todo identificador en inglés**: tablas, columnas, funciones, variables, componentes,
  archivos, carpetas, servicios de Docker, variables de entorno, codes de catálogo y eventos de
  GA. En español solo: textos que ve el usuario, comentarios (como el resto del repo) y las URLs
  públicas del formulario (`/embalaje/cotizar/...`).
- Qué transportista ofrece qué servicio vive en una **tabla puente**
  (`carrier_company_service_types`), no en una columna de `carrier_company` (ver §2.1).

## 2. Modelo de datos — migración `migrations/versions/018_add_service_requests.py`

Sigue el estilo de las migraciones existentes (`revision = '018'`, `down_revision = '017'`)
con SQL crudo e `IF NOT EXISTS` (ver CLAUDE.md). Docstring en el estilo de la 017 explicando
el porqué.

```sql
CREATE TABLE IF NOT EXISTS lu_service_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,      -- 'packing'
  name VARCHAR(60) NOT NULL,             -- 'Embalaje'
  active SMALLINT NOT NULL DEFAULT 1
);
INSERT INTO lu_service_types (code, name) VALUES ('packing', 'Embalaje')
  ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS service_requests (
  id SERIAL PRIMARY KEY,
  public_id VARCHAR(32) NOT NULL UNIQUE,  -- uuid4().hex; el único id que ve el navegador
  service_type_id INTEGER NOT NULL REFERENCES lu_service_types(id),
  country_id INTEGER REFERENCES lu_country(id),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft | submitted | cancelled
  whatsapp VARCHAR(20),                   -- E.164 (+51...), se llena al enviar
  preferred_date DATE,                    -- día en que el cliente quiere el servicio (sin hora)
  street VARCHAR(200),                    -- formatted_address de Google Places
  interior VARCHAR(100),                  -- dpto / interior / referencia (opcional)
  neighborhood VARCHAR(100),              -- distrito
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(20),
  map_url VARCHAR(400),
  details JSON,                           -- campos propios de cada servicio; packing no usa ninguno por ahora
  submitted_at TIMESTAMP,
  created_date TIMESTAMP DEFAULT now(),
  updated_date TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_request_items (
  id SERIAL PRIMARY KEY,
  service_request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  description VARCHAR(200) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0
);

-- Catálogo de materiales, por tipo de servicio (embalaje hoy; otro servicio podría tener los suyos).
-- `code` es lo que viaja en la API: estable entre entornos, a diferencia del id SERIAL.
CREATE TABLE IF NOT EXISTS lu_service_materials (
  id SERIAL PRIMARY KEY,
  service_type_id INTEGER NOT NULL REFERENCES lu_service_types(id),
  code VARCHAR(30) NOT NULL,
  name VARCHAR(60) NOT NULL,             -- lo que ve el cliente
  description VARCHAR(200),              -- ayuda corta en el formulario
  position INTEGER NOT NULL DEFAULT 0,   -- orden de los checkboxes
  active SMALLINT NOT NULL DEFAULT 1,    -- desactivar en vez de borrar: hay items que lo referencian
  UNIQUE (service_type_id, code)
);
INSERT INTO lu_service_materials (service_type_id, code, name, description, position)
SELECT st.id, m.code, m.name, m.description, m.position
FROM lu_service_types st,
  (VALUES
    ('cardboard_sheet', 'Cartón',         'Planchas para proteger superficies y esquinas', 1),
    ('stretch_film',    'Film',           'Film stretch para envolver muebles',            2),
    ('carpet',          'Alfombra',       'Para proteger muebles durante el traslado',     3),
    ('cardboard_box',   'Caja de cartón', 'Para objetos sueltos, ropa, libros, vajilla',   4),
    ('wooden_crate',    'Caja de madera', 'Para objetos muy frágiles o de valor',          5)
  ) AS m(code, name, description, position)
WHERE st.code = 'packing'
ON CONFLICT (service_type_id, code) DO NOTHING;

-- Qué materiales marcó el cliente en cada item. Ninguno = "que el transportista recomiende".
CREATE TABLE IF NOT EXISTS service_request_item_materials (
  item_id INTEGER NOT NULL REFERENCES service_request_items(id) ON DELETE CASCADE,
  material_id INTEGER NOT NULL REFERENCES lu_service_materials(id),
  PRIMARY KEY (item_id, material_id)
);

CREATE TABLE IF NOT EXISTS service_request_media (
  id SERIAL PRIMARY KEY,
  service_request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,
  storage_key VARCHAR(300) NOT NULL,
  media_type VARCHAR(10) NOT NULL,        -- image | video
  content_type VARCHAR(60),
  size_bytes INTEGER,
  created_date TIMESTAMP DEFAULT now()
);

-- Qué transportista ofrece qué servicio. No todos embalan: sin esto se avisaría a todos.
-- Ver §2.1 por qué es tabla puente y no columna en carrier_company.
CREATE TABLE IF NOT EXISTS carrier_company_service_types (
  carrier_company_id INTEGER NOT NULL REFERENCES carrier_company(id) ON DELETE CASCADE,
  service_type_id INTEGER NOT NULL REFERENCES lu_service_types(id) ON DELETE CASCADE,
  created_date TIMESTAMP DEFAULT now(),
  PRIMARY KEY (carrier_company_id, service_type_id)
);

-- A quién se le avisó. Hace idempotente el envío (doble clic / reenvío desde backoffice).
CREATE TABLE IF NOT EXISTS service_request_notifications (
  id SERIAL PRIMARY KEY,
  service_request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  carrier_company_id INTEGER NOT NULL REFERENCES carrier_company(id),
  sent_at TIMESTAMP DEFAULT now(),
  UNIQUE (service_request_id, carrier_company_id)
);
```

Agregar el trigger de `updated_date` si `db/init.sql` lo usa para otras tablas (revisar al
final de ese archivo), o setearlo con `onupdate=func.now()` en el modelo como hace `Order`.

**Notas:**
- Usar `db.JSON` (no `JSONB`) en los modelos: los tests corren en SQLite (`tests/conftest.py`).
- `public_id` existe a propósito: los ids de `orders` son correlativos y ya causaron un hueco
  de seguridad (ver comentario en `update_order`, `app/api/orders.py`). El formulario público
  solo conoce `public_id`; el `id` entero solo lo usan backoffice y tokens firmados.
- La validación de `details` va en Python por tipo de servicio (registro simple, ver §3.4), así
  agregar "limpieza" mañana es una fila en `lu_service_types` + un validador, sin migración.
- Agregar un material nuevo = un `INSERT` en `lu_service_materials` (o una migración con
  `ON CONFLICT DO NOTHING`). Formulario, backoffice y validación lo toman solos porque leen el
  catálogo; ningún frontend tiene los materiales escritos a mano.

### 2.1 Por qué tabla puente para "el transportista embala" y no columna en `carrier_company`

Una columna (`carrier_company.does_packing BOOLEAN`) parece más simple, pero:

- Cada servicio nuevo sería una migración + cambios de código (columna, formulario, filtro de
  avisos). Con la tabla puente es una fila en `lu_service_types` y el checkbox aparece solo.
- La relación puede crecer con datos propios de "esta empresa hace este servicio" que una
  columna booleana no admite: desde cuándo (`created_date`), y más adelante, si hace falta,
  distritos que cubre o precio mínimo para ese servicio.
- El filtro de avisos queda igual para todos los servicios: un `JOIN` por `service_type_id`.

En el código igual se lee como un atributo: relación SQLAlchemy
`CarrierCompany.service_types` (`secondary='carrier_company_service_types'`), así que
`'packing' in [s.code for s in company.service_types]` funciona sin columna nueva.

Nombre: `carrier_company_service_types` (y no `carrier_services`) porque nombra las dos tablas
que une y evita confundirse con `lu_services` / `orders_services`, que son los **adicionales de
una mudanza** (cargadores, empaque, armado). Ojo: `lu_services.packaging` ("empaque" dentro de
una mudanza) y `lu_service_types.packing` (embalaje como servicio suelto) son cosas distintas;
este plan no toca el primero.

Quién marca el check: solo admin/superadmin, desde el formulario de la empresa en el backoffice
(Chalán decide quién embala bien). La mudanza **no** entra en este catálogo por ahora: hoy todos
los transportistas activos reciben mudanzas y meterla aquí obligaría a cambiar ese flujo.

### Modelos

- **Main API** (`app/models.py`): `ServiceType`, `ServiceMaterial`, `ServiceRequest`
  (relaciones `items` ordenadas por `position`, `media`, `service_type`), `ServiceRequestItem`
  (relación `materials`, `secondary='service_request_item_materials'`), `ServiceRequestMedia`,
  `CarrierCompanyServiceType`, `ServiceRequestNotification`, y la relación
  `CarrierCompany.service_types`.
- **Backoffice API** (`backoffice-api/app/models.py`): los mismos modelos (son apps separadas
  con modelos propios sobre la misma BD). Agregar `to_dict()` siguiendo el estilo de los
  modelos de ese archivo (`_iso()` para fechas).

## 3. Main API (Flask, `/api/v1`) — endpoints públicos del formulario

Archivo nuevo `app/api/service_requests.py`, registrado en el import de `app/api/__init__.py`.
Sin autenticación (como el paso 1 del flujo Vue), pero todo por `public_id`.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/service-types/<code>/materials` | Catálogo activo de materiales del servicio, ordenado por `position` → `[{code, name, description}]` |
| POST | `/service-requests` | Crea borrador. Body: `{service_type: 'packing', address: {...}, website: ''}`. 201 → `{public_id}` |
| GET | `/service-requests/<public_id>` | Devuelve la solicitud (dirección, details, items, media, status) para retomar el borrador |
| PATCH | `/service-requests/<public_id>` | Actualiza `address`, `details` y/o `items` (lista completa, reemplaza). 409 si `status != 'draft'` |
| POST | `/service-requests/<public_id>/media/presign` | Body `{content_type, size_bytes}` → `{upload: {url, fields}, storage_key}` |
| POST | `/service-requests/<public_id>/media` | Body `{storage_key}`. Verifica que el objeto exista en S3 y que la key empiece con `service-requests/<public_id>/` → crea fila → `{id, url, media_type}` |
| DELETE | `/service-requests/<public_id>/media/<id>` | Borra de S3 y BD. Solo en `draft` |
| POST | `/service-requests/<public_id>/submit` | Body `{whatsapp, preferred_date}`. Valida, pasa a `submitted`, avisa. Idempotente |
| POST | `/service-requests/<int:id>/notify-carriers` | **Solo interno** (`is_internal_request()`): reenvía a transportistas aún no avisados. Lo usa el backoffice-api |

### 3.1 Validaciones

- **Dirección** (`address`): requiere `street`, `country` y `map_url` — es la prueba de que el
  usuario eligió una opción de Google Places. No relajar esta regla (es la misma razón por la que
  el flujo de mudanza las exige). `interior` opcional.
- **Honeypot**: si `website` llega no vacío, responder 201 con un `public_id` falso y no guardar
  nada (no darle pistas al bot).
- **Items**: 1–50 items, `description` 1–200 caracteres (trim), `quantity` entero 1–999,
  `materials`: lista de `code` (puede ser vacía = "que el transportista recomiende"). Cada code
  debe existir en `lu_service_materials`, estar `active` y pertenecer al mismo
  `service_type_id` de la solicitud; si no, 400 nombrando el code. Codes repetidos se
  deduplican. Forma de un item en PATCH/GET: `{description, quantity, materials: ['stretch_film', 'carpet']}`.
- **details (packing)**: hoy vacío (`{}` o ausente). Se deja la columna para servicios futuros.
- **Media**: máx. 10 archivos por solicitud.
  - Imágenes ≤ 10 MB: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`.
  - Videos ≤ 100 MB: `video/mp4`, `video/quicktime` (iPhone), `video/webm`.
  - `media_type` se deriva del `content_type`, nunca se acepta del cliente.
- **Fecha deseada** (`preferred_date`): `YYYY-MM-DD`, desde **mañana** hasta hoy + 90 días,
  calculando "hoy" en `America/Lima` (no en UTC del servidor: a las 8 p. m. de Lima ya es
  mañana en UTC). Se guarda como `DATE`, sin hora, justamente para no repetir los líos de zona
  horaria de `orders.appointment_date`. Se acepta también en PATCH (para retomar el borrador).
- **Submit**: requiere dirección completa, ≥ 1 item, `preferred_date` válida (la del body o la
  ya guardada, revalidada contra el rango: un borrador viejo puede tener una fecha ya pasada) y
  `whatsapp` que pase `normalize_phone()` (`app/api/whatsapp.py`) — guardar el valor
  normalizado E.164. Si ya está
  `submitted`, responder 200 con el estado actual **sin** volver a avisar.

Errores en el formato que ya usa la API: `{'message': ...}` con 400/404/409.

### 3.2 Subida directa a S3 (presigned POST)

nginx limita `/api` a 5 MB y un video de 100 MB por gunicorn bloquearía un worker, así que el
navegador sube directo a S3:

- En `app/storage/base.py` agregar los abstractos `presigned_post(key, content_type, max_bytes,
  expires_in=600)` y `head(key)`; implementarlos en `app/storage/s3.py`:
  - `generate_presigned_post(Bucket, Key, Fields={'Content-Type': ct}, Conditions=[{'Content-Type': ct}, ['content-length-range', 1, max_bytes]], ExpiresIn=...)`.
  - `head(key)` → `head_object`; devuelve `{size, content_type}` o `None` si no existe.
  - Extraer la construcción de la URL pública a un método (`public_url(key)`) y reusarlo en `upload()`.
- Key: `service-requests/<public_id>/<uuid4hex>.<ext>`.
- En el registro (`POST .../media`) usar `head()` para leer tamaño y content-type reales.

### 3.3 Notificaciones al enviar — `app/api/service_request/notifications.py`

`notify_service_request(service_request)`:

1. Transportistas destino: `carrier_company.active = 1`, `country_id = COUNTRY_ID`, y con fila en
   `carrier_company_service_types` para ese tipo de servicio, **excluyendo** los que ya tienen
   fila en `service_request_notifications`.
2. Por cada uno:
   - Token: `generate_service_request_token(service_request.id, carrier_company.id)` — JWT HS256
     con `SECRET_KEY`, payload `{purpose: 'service_request', service_request_id,
     carrier_company_id, iat, exp: +10 días}`. El `purpose` impide usar un token de cotización
     de órdenes en esta ruta y viceversa.
   - URL: `f"{SITE_URL}/backoffice/carrier-view/{token}"`.
   - `send_email(carrier.email, 'Nueva solicitud de embalaje Chalán', 'email/ask_for_service_quotation', bcc=[], ...)`
     — plantillas nuevas `.html` y `.txt` en el mismo directorio que `email/ask_for_quotation`,
     con el mismo estilo. El asunto usa `service_type.name`; el cuerpo adelanta distrito y fecha
     deseada (lo primero que mira un transportista para saber si puede) además del link.
   - `send_whatsapp(carrier.phone, os.getenv('TWILIO_TEMPLATE_SERVICE_REQUEST'), {'1': service_type.name.lower(), '2': url}, body_label='[Plantilla: Nueva solicitud de servicio]')`.
     `send_whatsapp` ya se salta solo si el template no está configurado, así que funciona
     antes de que Meta lo apruebe (solo sale el email).
   - Insertar fila en `service_request_notifications`.
3. Aviso al admin (siempre, aunque no haya transportistas):
   - `send_email(NOTIFY_EMAIL, ...)` con link a `{SITE_URL}/backoffice/service-requests/{id}`,
     el WhatsApp del cliente, distrito, fecha deseada y cantidad de items. Si no se avisó a ningún transportista,
     decirlo explícitamente en el email ("Ningún transportista tiene embalaje activado").
   - `send_whatsapp(NOTIFY_WHATSAPP_PHONE, TWILIO_TEMPLATE_SERVICE_REQUEST, {'1': ..., '2': admin_url})`
     — la misma plantilla sirve porque su texto es genérico (ver §8).

El submit hace commit del cambio de estado **antes** de notificar; si una notificación falla se
loguea y no tumba la respuesta (igual que `send_email_to_carrier_companies`).

### 3.4 Registro por tipo de servicio

En `app/api/service_request/types.py`:

```python
SERVICE_TYPES = {
    'packing': {'validate_details': validate_packing_details},
}
```

`create`/`patch` rechazan con 400 un `service_type` que no esté aquí o no esté `active` en BD.

### 3.5 Tests — `tests/test_service_requests.py`

Con los fixtures de `tests/conftest.py` y `send_email`/`send_whatsapp`/storage mockeados:
- crear sin `map_url` → 400; con dirección completa → 201 y `public_id` de 32 chars.
- honeypot lleno → 201 y no hay filas.
- PATCH reemplaza items con sus materiales; PATCH después de submit → 409.
- material inexistente, inactivo o de otro tipo de servicio → 400; lista vacía → 200.
- `GET /service-types/packing/materials` no devuelve materiales inactivos y respeta `position`.
- submit sin items o con WhatsApp inválido → 400; guarda WhatsApp en E.164.
- `preferred_date` hoy, pasada, a más de 90 días o mal formada → 400; mañana → OK. Fijar el
  reloj en el test (p. ej. 23:30 de Lima, cuando en UTC ya es el día siguiente) para cubrir la
  zona horaria.
- submit de un borrador cuya fecha guardada quedó en el pasado → 400.
- submit dos veces → la segunda no vuelve a llamar a `send_email`/`send_whatsapp`.
- solo se avisa a transportistas activos que tienen el servicio en `carrier_company_service_types`.
- media: key con otro `public_id` → 400; `content_type` no permitido → 400; más de 10 → 400.
- `notify-carriers` sin cabecera interna → 403.

Correr `pytest tests/test_service_requests.py` (no correr la suite de Playwright).

## 4. Mini app `services-web/` (Vite + React + Tailwind)

### 4.1 Setup

Copiar la base de `backoffice/` (no sus páginas):
- `package.json`: `react`, `react-dom`, `react-router-dom`, `axios` (mismas versiones que el
  backoffice); dev: `vite`, `@vitejs/plugin-react`, `tailwindcss@3`, `postcss`, `autoprefixer`.
  Sin react-query (son 6 llamadas). Scripts `dev`, `build`, `preview`.
- `vite.config.js`: `base: '/services-web/'` (prefijo de los assets, independiente de la URL del
  servicio, para que mañana `/limpieza/cotizar` use el mismo build), `server.port: 5174`,
  `server.host: '0.0.0.0'`, `watch.usePolling: true` (igual que backoffice) y
  `server.proxy: {'/api': 'http://localhost:8001'}` para desarrollo sin CORS.
- Env: `VITE_API_URL` (default `/api/v1`), `VITE_PLACES_API_KEY`, `VITE_GA_ID`
  (default `G-72KVLDWMQD`, el mismo que usa `frontend/public/index.html`).
- `index.html`: `lang="es"`, `<meta name="robots" content="noindex">` (lo que debe posicionar es
  la landing `/embalaje-profesional`, no el formulario), viewport, favicon de Chalán, Google
  Fonts Inter Tight, y el snippet gtag copiado de `frontend/public/index.html`.
- Estética: alinear con la landing (`frontend-react/src/app/landing.css`): mismos colores
  (`--ink`, `--paper`, `--line`, etc. → `tailwind.config.js` `theme.extend.colors`) y tipografía.
  **Mobile first**: la mayoría llega desde el celular.

### 4.2 Estructura

```
services-web/src/
  main.jsx                 BrowserRouter
  App.jsx                  rutas
  api.js                   axios + funciones por endpoint
  analytics.js             wrapper de gtag (copiar la idea de frontend/src/utils/analytics.js)
  storage.js               localStorage con try/catch (ver frontend/src/utils/safeStorage)
  context/RequestContext.jsx   estado del borrador + public_id persistido
  components/
    StepTracker.jsx        barra "1 Dirección · 2 Qué embalamos · 3 Fecha y contacto"
    AddressAutocomplete.jsx
    ItemsEditor.jsx
    MediaUploader.jsx
    StepNav.jsx            botones Atrás / Siguiente
  pages/packing/
    AddressStep.jsx
    ItemsStep.jsx
    ContactStep.jsx
    Sent.jsx
```

Rutas:
- `/embalaje/cotizar` → redirige a `/embalaje/cotizar/direccion`
- `/embalaje/cotizar/direccion`, `/embalaje/cotizar/que-embalamos`, `/embalaje/cotizar/fecha-y-contacto`
- `/embalaje/cotizar/enviado`
- Un paso posterior sin borrador válido redirige a `direccion` (equivalente a
  `requiresPreviousComplete` del router Vue).

### 4.3 Estado y persistencia

- `RequestContext` guarda `{publicId, address, materials, items, media, status}`.
- `publicId` se persiste en localStorage (`chalan_packing_request`). Al montar: si existe, `GET`;
  si responde 404 o `status !== 'draft'`, borrar la clave y empezar de cero.
- El borrador se crea (`POST`) al pulsar "Siguiente" en el paso 1, no al cargar la página, para
  no llenar la BD de filas vacías. Los pasos siguientes hacen `PATCH` al avanzar.

### 4.4 Paso 1 — Dirección

- `AddressAutocomplete`: carga el script de Maps una sola vez
  (`https://maps.googleapis.com/maps/api/js?key=...&libraries=places`, mismo patrón que
  `frontend/src/components/SearchBoxPlacesApiGoogle.vue`) y usa
  `google.maps.places.Autocomplete` con `componentRestrictions: {country: 'pe'}` y
  `fields: ['address_components', 'formatted_address', 'url']`.
- Mapear: `street = formatted_address`, `neighborhood` = `sublocality_level_1` o `locality`
  (distrito), `city` = `administrative_area_level_2`, `state` = `administrative_area_level_1`,
  `country` = short_name de `country` (`PE`), `map_url = place.url`.
- Si el usuario escribe y no elige de la lista: limpiar `map_url` y mostrar
  "Elige tu dirección de la lista". No se puede avanzar sin `map_url`.
- Campo opcional "Dpto / interior / referencia".
- Si la API de Maps no carga, mostrar un error claro con botón de WhatsApp como salida (no
  dejar al usuario atascado).

### 4.5 Paso 2 — Qué embalamos

- **Lista de cosas** (`ItemsEditor`): cada item es una tarjeta con descripción + cantidad
  (stepper − / +) + quitar, y sus **materiales** como checkboxes tipo chip (toggle) con los
  materiales que devuelve `GET /service-types/packing/materials` (se pide una vez al montar el
  paso; nada hardcodeado).
  - Layout: en desktop (`md:`) los chips van al costado de la descripción; en mobile van debajo,
    en una fila que hace wrap. Cinco checkboxes al costado no caben en 360 px.
  - El `description` del material se muestra como ayuda (`title` en desktop y un ícono "?" que
    abre un texto corto en mobile, donde no hay hover).
  - Ayuda general sobre la lista: "Si no sabes qué material necesita, déjalo sin marcar y el
    transportista te recomienda".
  - Chips de agregado rápido: Sofá, Cama, Colchón, Refrigeradora, Lavadora, TV, Vajilla,
    Cuadros/espejos, Ropa, Libros. Cada chip trae materiales sugeridos ya marcados (el cliente
    los puede cambiar), definidos en una constante del frontend **por code**, p. ej.
    `Sofá → ['stretch_film', 'carpet']`, `Vajilla → ['cardboard_box']`,
    `Cuadros/espejos → ['cardboard_sheet', 'wooden_crate']`. Si un code sugerido ya no está en el
    catálogo se ignora en silencio. Esta es la única referencia a codes en el frontend y es
    opcional: sin ella todo funciona.
  - Mínimo 1 item para avanzar.
- **Fotos o videos** (`MediaUploader`), opcional:
  `<input type="file" accept="image/*,video/*" multiple>`. Por archivo: validar tipo/tamaño en
  el cliente con los mismos límites del backend → `presign` → POST a S3 con `FormData`
  (`fields` + `file` al final) mostrando progreso (`onUploadProgress`) → registrar en la API →
  miniatura (`<img>` o `<video preload="metadata">`) con botón quitar. Errores por archivo, sin
  bloquear los demás. "Siguiente" deshabilitado mientras haya subidas en curso.

### 4.6 Paso 3 — Fecha y contacto, y envío

- **Fecha deseada**: `<input type="date">` nativo (en el celular abre el calendario del
  sistema) con `min` = mañana y `max` = hoy + 90 días, ambos calculados en hora de Lima.
  Debajo, la fecha elegida en texto ("sábado 18 de octubre") con
  `toLocaleDateString('es-PE', {timeZone: 'America/Lima', ...})`, y la ayuda "Para una casa
  completa te recomendamos 2–3 días de anticipación" (lo mismo que dice la landing). Obligatoria.
  Ojo: `new Date('2026-10-18')` se interpreta como UTC y en Lima muestra el día anterior; armar
  la fecha con sus partes o formatear con `timeZone: 'UTC'`.
- **WhatsApp**: input con prefijo fijo `+51`, 9 dígitos, empieza con 9. Texto: "Te escribiremos por aquí con
  las cotizaciones".
- Resumen de lo cargado (dirección, items con sus materiales, n.º de fotos/videos, fecha) con link
  "Editar" a cada paso.
- "Enviar solicitud" → `submit` → limpiar localStorage → `/embalaje/cotizar/enviado`.
- `Sent.jsx`: confirmación ("Recibimos tu solicitud, te escribiremos por WhatsApp con las
  cotizaciones") + botón "Escríbenos por WhatsApp" a `https://wa.me/51972643007` (el mismo número
  de la landing).

### 4.7 Analytics (GA4)

Eventos vía `analytics.js`: `service_request_step_view` (`{service: 'packing', step}`),
`service_request_started` (al crear el borrador), `service_request_media_uploaded`,
`service_request_submitted`. Nunca mandar el WhatsApp ni la dirección a GA.

## 5. Backoffice API (`backoffice-api/`)

Archivo nuevo `backoffice-api/app/api/service_requests.py`, registrado igual que los demás
módulos de `backoffice-api/app/api/__init__.py`.

| Método | Ruta | Rol | Qué hace |
|---|---|---|---|
| GET | `/service-types` | login | Catálogo activo (para checkboxes del transportista) |
| GET | `/service-requests?status=&service_type=` | admin, superadmin | Lista, más recientes primero. Incluye `items_count`, `media_count`, `notified_count`, distrito |
| GET | `/service-requests/<id>` | admin, superadmin | Detalle completo: WhatsApp, items, media, materiales, transportistas avisados (nombre + `sent_at`) y `links` por transportista que ofrece el servicio (como `get_quotation_links`) |
| POST | `/service-requests/<id>/notify-carriers` | admin, superadmin | Proxy al endpoint interno de la main API (mismo patrón que `/orders/<id>/notify-carriers`: `INTERNAL_API_URL` + `_internal_headers()`) |
| PATCH | `/service-requests/<id>` | admin, superadmin | Solo `{status: 'cancelled'}` |
| GET | `/public/service-requests/<token>` | **ninguno** | Vista del transportista (ver abajo) |

**Endpoint público del transportista:**
- Decodifica el JWT con `SECRET_KEY`; exige `purpose == 'service_request'`.
- Token inválido, de otro propósito o solicitud inexistente → **404**; expirado → **410**.
  **Nunca 401**: el interceptor de `backoffice/src/api/client.js` redirige a /login con un 401.
- Respuesta: `service_type`, `preferred_date`, `created/submitted` (fechas), dirección completa + `map_url`,
  `items` (cada uno con `materials: [{code, name}]`), `materials_summary` (por material: cuántos
  items y suma de cantidades, para que el transportista calcule cuánto llevar), `media`, y el
  nombre del transportista del token.
  **No incluir el WhatsApp del cliente** (el transportista responde a Chalán, no al cliente).
- Si la solicitud está `cancelled`, devolverla con ese estado para que la página lo diga.

**Transportistas — servicios que ofrecen:** en `backoffice-api/app/api/carrier_companies.py`,
incluir `service_type_ids` en el GET de una empresa y aceptarlo en el create/update (reemplaza
las filas de `carrier_company_service_types`). Solo admin/superadmin pueden cambiarlo.

## 6. Backoffice frontend (`backoffice/`)

- **Ruta pública** en `App.jsx`, **fuera** del `<ProtectedRoute><Layout/>`:
  `<Route path="/carrier-view/:token" element={<ServiceRequestCarrierView />} />`.
  `pages/service-requests/CarrierView.jsx`:
  - Cabecera simple con el logo de Chalán (sin sidebar).
  - Tipo de servicio, **fecha deseada** destacada arriba, fecha de la solicitud, distrito, dirección + "Ver en Google Maps", resumen de materiales
    (p. ej. "Film: 3 items · Caja de madera: 1 item"), tabla de items (cantidad × descripción +
    sus materiales como badges, o "a recomendar" si no marcó ninguno), galería (click abre
    la imagen en grande; videos con `<video controls preload="metadata">`).
  - CTA fija abajo en mobile: "Enviar mi precio por WhatsApp" →
    `https://wa.me/51972643007?text=` con "Cotización solicitud #<id> (<servicio>): S/ " prellenado.
  - Estados: cargando, 404 "Link no válido", 410 "Este link venció, pide uno nuevo a Chalán",
    cancelada.
- **Admin** (rutas con `ProtectedRoute allowedRoles={['superadmin','admin']}`):
  - `service-requests` → `pages/service-requests/List.jsx`: pestañas "Enviadas" / "Incompletas"
    (borradores) / "Canceladas"; columnas: #, servicio, fecha deseada, distrito, items, fotos/videos,
    transportistas avisados, fecha.
  - `service-requests/:id` → `pages/service-requests/Detail.jsx`: todo lo de la vista del
    transportista + WhatsApp del cliente con link a `/whatsapp/<E.164>` (chat existente) +
    lista de transportistas avisados + links copiables por transportista (reusar el patrón de
    copiar de `orders/Detail.jsx`) + botones "Reenviar a transportistas no avisados" y "Cancelar".
  - `components/Sidebar.jsx`: item "Embalajes" para admin/superadmin.
- **`carrier-companies/Form.jsx`**: sección "Servicios que ofrece" con un checkbox por
  `GET /service-types`, visible y editable solo para admin/superadmin.

## 7. Infraestructura

La mini app corre en **su propio contenedor** (`services-web`), dentro de
`docker-compose-peru.prod.yml`, para poder desplegarla sin reconstruir nginx (que arrastra el
build del Vue y del backoffice). Mismo modelo que Next.js: servicio aparte en el mismo archivo.
**No** usar un yml separado: con los dos archivos en la raíz del repo, Compose los trata como el
mismo proyecto, avisa de "contenedores huérfanos" en cada `up` y un `--remove-orphans` desde
cualquiera de los dos tumba los contenedores del otro.

**Producción Perú**
- `services-web/Dockerfile.prod` (multi-stage):
  ```dockerfile
  FROM node:20-alpine AS build
  WORKDIR /app
  COPY services-web/package.json services-web/package-lock.json ./
  RUN npm ci
  COPY services-web .
  ARG VITE_PLACES_API_KEY
  ARG VITE_GA_ID
  ENV VITE_PLACES_API_KEY=$VITE_PLACES_API_KEY
  ENV VITE_GA_ID=$VITE_GA_ID
  ENV VITE_API_URL=/api/v1
  RUN npm run build

  FROM nginx:alpine
  COPY --from=build /app/dist /usr/share/nginx/html/services-web
  COPY services-web/nginx.conf /etc/nginx/conf.d/default.conf
  ```
- `services-web/nginx.conf` (escucha en 80 dentro de la red de Docker, sin TLS):
  ```nginx
  server {
      listen 80;
      root /usr/share/nginx/html;

      # Archivos del build (assets, favicon). =404 para que un archivo faltante no devuelva
      # el index.html con 200 (mismo problema que ya pasó con el backoffice).
      location /services-web/ {
          try_files $uri =404;

          # Los assets llevan hash: caché eterna.
          location /services-web/assets/ {
              add_header Cache-Control "public, max-age=31536000, immutable" always;
              try_files $uri =404;
          }
      }

      # Cualquier ruta del formulario devuelve el index, que nunca se cachea: es el que nombra
      # los bundles del deploy actual.
      location / {
          add_header Cache-Control "no-store, must-revalidate" always;
          try_files /services-web/index.html =404;
      }
  }
  ```
- `docker-compose-peru.prod.yml`: servicio nuevo
  ```yaml
  services-web:
    build:
      context: .
      dockerfile: services-web/Dockerfile.prod
      args:
        VITE_PLACES_API_KEY: ${NEXT_PUBLIC_PLACES_API_KEY}
        VITE_GA_ID: ${VITE_GA_ID:-G-72KVLDWMQD}
    restart: always
  ```
  (misma key de Places que usa Next.js). **No** agregarlo al `depends_on` de nginx: el proxy
  usa una variable + `resolver` (ver abajo), así nginx arranca aunque `services-web` esté caído
  o reconstruyéndose.
- `nginx.chalan-prod-peru.conf`: junto a las otras variables de upstream,
  `set $services_web_backend http://services-web:80;` y, junto a los bloques del backoffice:
  ```nginx
  # Mini app de servicios (embalaje), en su propio contenedor para desplegarla sola.
  location /embalaje/cotizar {
      proxy_pass $services_web_backend;
      proxy_set_header Host $host;
  }
  location /services-web/ {
      proxy_pass $services_web_backend;
      proxy_set_header Host $host;
  }
  ```
  Con `proxy_pass` a una variable nginx reenvía la URI original tal cual, que es lo que espera
  el nginx interno. Comprobar que `/embalaje-profesional` (Next.js) sigue yendo a `location /`.
- Deploy del formulario solo (no toca nginx ni el Vue):
  `docker-compose -f docker-compose-peru.prod.yml up -d --build services-web`.
  En el primer deploy, además, reconstruir nginx (por el cambio de conf), siempre **después**
  de `services-web` y de a un servicio por vez.
- `Dockerfile.nginx.peru.prod` **no** cambia.

**Local**
- `services-web/Dockerfile.local` (copia de `backoffice/Dockerfile.local`, corre `npm run dev`)
  y servicio `services-web` en `docker-compose.local.yml` (puerto 5174, volumen
  `./services-web/src:/app/src`, `VITE_API_URL=/api/v1`, `env_file` con `VITE_PLACES_API_KEY`).
- `nginx/nginx.chalan-local.conf`: `location /embalaje/cotizar` y `location /services-web/` →
  `proxy_pass http://services-web:5174` (con los headers de upgrade para HMR que ya están en el
  `server`).

**Landing Next.js** (`frontend-react/src/app/embalaje-profesional/page.tsx`)
- CTA principal del hero y de `LandingNav` → "Cotizar en 2 minutos" a `/embalaje/cotizar`.
  WhatsApp queda como opción secundaria. Usar `<a href>` (no `next/link`): la ruta no es de Next.
- Ajustar el copy del paso 01 ("Cotiza por WhatsApp" → "Cuéntanos qué embalar") y quitar
  "Sin formularios" de la tarjeta del hero. No tocar los JSON-LD salvo textos que dejen de ser
  ciertos.

## 8. Tareas manuales (las hace Carlos, no el código)

1. **Plantilla WhatsApp en Twilio/Meta** con texto genérico de 2 variables, p. ej.:
   "Hola, hay una nueva solicitud de {{1}} en Chalán. Revisa los detalles aquí: {{2}}".
   Cuando esté aprobada, poner su SID en `TWILIO_TEMPLATE_SERVICE_REQUEST` en `.env.prod`.
   Hasta entonces solo salen emails.
2. **CORS del bucket S3**: permitir `POST` desde `https://chalan.pe`, `https://www.chalan.pe` y
   `http://local.chalan.mx`.
3. **SECRET_KEY**: confirmar que `.env.prod` y `.env.backoffice.prod` tienen el mismo valor
   (el token se firma en la main API y se verifica en el backoffice-api).
4. **Google Places key**: verificar que su restricción por referrer cubra `chalan.pe/embalaje/*`.
5. Marcar en el backoffice qué transportistas ofrecen embalaje.
6. Correr la migración 018 en producción.

## 9. Orden de implementación

1. Migración 018 + modelos en ambas APIs.
2. Storage (`presigned_post`, `head`, `public_url`) + endpoints públicos + notificaciones + tests.
3. Mini app `services-web/` completa, probada contra la API local.
4. Backoffice API (admin + endpoint público + servicios del transportista).
5. Backoffice frontend (vista del transportista, lista/detalle admin, checkboxes en empresa).
6. Infra (contenedor `services-web`, compose, nginx Perú y local) + CTA de la landing.
7. Verificación: `npm run build` en `services-web/`, `backoffice/` y `frontend-react/`;
   `pytest tests/test_service_requests.py`.

Por cada fase, un commit en inglés en el estilo del repo. **No hacer push** ni correr la suite
de Playwright.

## 10. Criterios de aceptación

- Desde un celular se completa `/embalaje/cotizar` en 3 pasos; recargar a mitad retoma el
  borrador; una dirección que no salió de Google Places no deja avanzar.
- Cada item guarda sus propios materiales; un `INSERT` en `lu_service_materials` hace aparecer
  el material nuevo en el formulario y en el backoffice sin desplegar código, y desactivarlo lo
  oculta del formulario sin romper solicitudes viejas que lo usan.
- Se pueden subir fotos y un video de ~50 MB con barra de progreso; quitarlos los borra de S3.
- El paso 3 no deja elegir hoy, una fecha pasada ni más de 90 días adelante, y la fecha
  mostrada coincide con la guardada (sin corrimiento de un día por zona horaria).
- Al enviar: la fila queda `submitted` con WhatsApp en E.164 y `preferred_date`; cada transportista con embalaje
  activo recibe un email (y WhatsApp, si la plantilla está configurada) con un link que abre la
  vista pública del backoffice sin login y sin el WhatsApp del cliente; el admin recibe aviso.
- Enviar dos veces o recargar la página de envío no duplica avisos.
- En el backoffice el admin ve enviadas e incompletas, abre el detalle, salta al chat de
  WhatsApp del cliente, copia links por transportista y reenvía a los no avisados.
- `orders`, el flujo Vue y todo lo de México quedan sin cambios.

## 11. Abiertos (decidir antes o durante la implementación)

- **Rate limiting**: no hay limitador en el stack. Con honeypot + límites de tamaño alcanza para
  empezar; si aparece spam, agregar `flask-limiter` a `POST /service-requests` y `presign`.
