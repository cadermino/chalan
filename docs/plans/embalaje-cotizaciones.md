# Plan: cotizaciones de embalaje desde la vista del transportista

> Plan para implementar. Sigue a `docs/plans/embalaje-cotizar.md` (ya en producción).
> Alcance: **Perú solamente**. Identificadores en inglés (tablas, columnas, funciones,
> componentes, archivos); en español solo los textos que ve el usuario y los comentarios.

## 1. Objetivo y alcance

Hoy el transportista abre `https://chalan.pe/backoffice/carrier-view/<token>`, ve la
solicitud y manda su precio **por WhatsApp** a Chalán. Se automatiza ese último tramo:

1. En esa misma página el transportista escribe su **monto** y una **nota opcional** y lo envía.
   Puede actualizarlo mientras la solicitud siga abierta.
2. Se guarda como cotización de esa solicitud. Al admin le llega un aviso (email; WhatsApp si
   hay plantilla configurada).
3. En el detalle de la solicitud del backoffice el admin ve todas las cotizaciones comparadas,
   con el **total para el cliente** (monto + `PLATFORM_FEE`), y **elige una**.
4. El admin le pasa el precio al cliente él mismo (botón para copiar el mensaje y link al chat).

### Decisiones ya tomadas (no reabrir)

- **Hasta el backoffice.** El cliente no recibe nada automático ni tiene pantalla para elegir.
- **Comisión encima, como en mudanzas.** Se guarda el monto crudo del transportista; el total
  que ve el cliente es `round(amount * (1 + PLATFORM_FEE), 2)`. No hay comisión de agente
  (las solicitudes de servicio no tienen referidos).
- **Campos:** monto + nota opcional. Nada más.

### Fuera de alcance (no implementar)

Pantalla o WhatsApp automático para el cliente, que el cliente elija, avisar al transportista
elegido o a los no elegidos, pagos/reserva por Yape, comisiones de referidos.

## 2. Modelo de datos — migración `migrations/versions/019_add_service_request_quotations.py`

Mismo estilo que la 018 (`revision = '019'`, `down_revision = '018'`, SQL crudo,
`IF NOT EXISTS`, docstring con el porqué). **Unicidad como índice único con nombre**, no
`UNIQUE` en línea: `backoffice-api` hace `db.create_all()` al arrancar y puede crear la tabla
antes que la migración (ver el docstring de la 018).

```sql
CREATE TABLE IF NOT EXISTS service_request_quotations (
  id SERIAL PRIMARY KEY,
  service_request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  carrier_company_id INTEGER NOT NULL REFERENCES carrier_company(id),
  amount NUMERIC(10,2) NOT NULL,          -- precio del transportista, tal cual lo escribió
  note VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active | selected
  -- Se congelan al elegirla: si PLATFORM_FEE cambia después, lo acordado con el cliente no se mueve.
  platform_fee_rate NUMERIC(6,4),
  total_amount NUMERIC(10,2),
  selected_at TIMESTAMP,
  selected_by_admin_id INTEGER,
  created_date TIMESTAMP DEFAULT now(),
  updated_date TIMESTAMP DEFAULT now()
);
-- Una cotización por transportista por solicitud: recotizar actualiza la misma fila.
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_request_quotations_request_carrier
  ON service_request_quotations(service_request_id, carrier_company_id);
```

Notas:
- `amount` es `NUMERIC(10,2)` (soles con céntimos), a diferencia de `quotations.amount` de
  mudanzas, que es entero. En los modelos usar `db.Numeric(10, 2)` y **serializar siempre como
  número con `float(round(x, 2))`**: `jsonify` no debe recibir `Decimal` crudo.
- Solo hay `active` y `selected`. No hace falta `cancelled`: si la solicitud se cancela, sus
  cotizaciones quedan como estaban y la solicitud manda.
- Como máximo **una** `selected` por solicitud; lo garantiza la lógica de elección (§3.3) dentro
  de una transacción con `with_for_update()` sobre la solicitud.

Modelos `ServiceRequestQuotation` en **las dos** apps (`app/models.py` y
`backoffice-api/app/models.py`), con relación `ServiceRequest.quotations` y `carrier_company`.
En el backoffice, `to_dict()` con `_iso()` para fechas.

## 3. API principal (`app/`) — dueña de las escrituras y los avisos

Igual que en mudanzas (`accept_quotation` del backoffice hace proxy al API principal "para que
las dos no se desalineen"), toda la lógica vive acá y el backoffice-api solo controla acceso y
reenvía. Endpoints **internos** (`is_internal_request()`; sin la cabecera → 403), en
`app/api/service_requests.py`; la lógica en un módulo nuevo
`app/api/service_request/quotations.py`.

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/service-requests/<int:id>/quotations` | Crea o actualiza la cotización de un transportista. Body `{carrier_company_id, amount, note}` |
| POST | `/service-requests/<int:id>/quotations/<int:quotation_id>/select` | El admin la elige. Body `{admin_user_id}` |

### 3.1 Validaciones al cotizar

- La solicitud existe (404) y está `submitted`. `draft` → 409 `'service request was not sent yet'`;
  `cancelled` → 409 `'service request was cancelled'`.
- `carrier_company_id` existe (404).
- Si **otra** cotización de la solicitud ya está `selected` → 409 `'service request already assigned'`.
  Si la **propia** está `selected` → 409 `'quotation already selected'` (igual que mudanzas: no se
  cambia un precio ya acordado por detrás).
- `amount`: número (acepta `"350.5"` o `350.5`), `> 0` y `<= 100000`, se redondea a 2 decimales.
  Inválido → 400 `'amount must be a number between 0 and 100000'`.
- `note`: opcional, string, `strip()`, máx. 500 → 400 si se pasa. Vacía se guarda como `NULL`.
- Upsert por `(service_request_id, carrier_company_id)`. Devuelve 201 si es nueva y 200 si se
  actualizó, con `{id, amount, note, status, created: bool}`.

### 3.2 Aviso al admin

En `app/api/service_request/notifications.py`, `notify_new_quotation(service_request, quotation, created)`:
- Email a `NOTIFY_EMAIL`, plantilla nueva `email/service_request_quotation_admin.html` (mismo
  estilo que `service_request_admin.html`). Asunto: `Nueva cotización de <empresa> para la
  solicitud #<id>` o `<empresa> actualizó su cotización (#<id>)`. Cuerpo: empresa, monto, total
  con comisión, nota, fecha deseada, distrito, cuántas cotizaciones lleva la solicitud, y link a
  `{SITE_URL}/backoffice/service-requests/<id>`.
- WhatsApp a `NOTIFY_WHATSAPP_PHONE` **solo al crear** (no al actualizar, para no hacer spam), con
  una plantilla nueva `TWILIO_TEMPLATE_SERVICE_QUOTATION` de 2 variables (`{{1}}` empresa,
  `{{2}}` link). Si la variable no está definida, `send_whatsapp` ya se lo salta solo.
- Igual que en el envío de solicitudes: la cotización se guarda (commit) **antes** de avisar, y
  un aviso que falla se loguea sin tumbar la respuesta.

### 3.3 Elegir una cotización

`select_quotation(service_request_id, quotation_id, admin_user_id)`:
- Bloquear la solicitud (`with_for_update()`); 404 si la cotización no es de esa solicitud;
  409 si la solicitud no está `submitted`.
- Si ya hay otra `selected`, pasa a `active` y se limpian sus campos congelados
  (`platform_fee_rate`, `total_amount`, `selected_at`, `selected_by_admin_id`). Elegir la misma
  otra vez es idempotente (200, no cambia `selected_at`).
- La elegida: `status='selected'`, `platform_fee_rate = PLATFORM_FEE` actual,
  `total_amount = round(amount * (1 + rate), 2)`, `selected_at = utcnow()`,
  `selected_by_admin_id`.
- Sin avisos en esta versión.

### 3.4 Tests — ampliar `tests/test_service_requests.py`

Con los fixtures y mocks que ya tiene ese archivo (`sent`, `make_carrier`, `internal_headers`,
reloj de Lima):
- sin cabecera interna → 403 en ambos endpoints.
- cotizar una solicitud `submitted` → 201; la misma empresa otra vez → 200 y sigue habiendo una fila.
- `draft` o `cancelled` → 409; solicitud o empresa inexistente → 404.
- `amount` `0`, negativo, `100000.01`, `"abc"`, `None` → 400; `"350.555"` se guarda `350.56`.
- `note` de 501 caracteres → 400; `"   "` se guarda `NULL`.
- aviso: al crear sale email + WhatsApp al admin; al actualizar solo email; asunto distinto.
- un aviso que lanza excepción no cambia el 201 y la fila queda guardada.
- elegir: congela `platform_fee_rate` y `total_amount` (`monkeypatch.setenv('PLATFORM_FEE', '0.1')`,
  monto 100 → 110.00); elegir otra desmarca la anterior y limpia sus campos; elegir la misma dos
  veces no cambia `selected_at`.
- con una `selected`, otra empresa que cotiza → 409 `already assigned`; la elegida que intenta
  cambiar su monto → 409.
- cambiar `PLATFORM_FEE` después de elegir no cambia el `total_amount` guardado.

## 4. Backoffice API (`backoffice-api/app/api/service_requests.py`)

### 4.1 Público (transportista con token)

Extraer la decodificación del token que ya hace `get_service_request_for_carrier` a un helper
`_carrier_from_token(token)` que devuelve `(service_request, carrier_company_id)` o la respuesta
de error (404/410, **nunca 401**: el interceptor de axios del backoffice manda a /login).

- `GET /api/public/service-requests/<token>` (existente): agregar
  - `my_quotation`: `{amount, note, status, updated_date}` de la empresa del token, o `null`.
  - `quotation_state`: `open` | `selected_mine` | `selected_other` | `cancelled`.
  - **No** exponer montos ni nombres de otras empresas.
- `POST /api/public/service-requests/<token>/quotation` (nuevo), body `{amount, note}`: valida el
  token con el mismo helper y reenvía a `POST {INTERNAL_API_URL}/api/v1/service-requests/<id>/quotations`
  con `carrier_company_id` **sacado del token** (nunca del body). Devuelve tal cual 200/201/400/404/409;
  cualquier otro código o error de red → 502.

### 4.2 Admin (`@admin_required`)

- `GET /api/service-requests/<id>` (existente): agregar `quotations`, ordenadas por `amount`
  ascendente, cada una con `id, carrier_company_id, carrier_company_name, amount, note, status,
  created_date, updated_date` y `total_amount`: el congelado si está `selected`, si no
  `round(amount * (1 + PLATFORM_FEE actual), 2)` (mismo `os.environ.get('PLATFORM_FEE', 0.1)` que
  usa `_financial_breakdown` en `orders.py`). Agregar también `platform_fee_rate` a cada una.
- `GET /api/service-requests` (lista): agregar `quotations_count` y `min_amount` por fila, en una
  sola consulta agregada (mismo patrón que `_counts`).
- `POST /api/service-requests/<id>/quotations/<qid>/select` (nuevo): reenvía al endpoint interno
  con `admin_user_id = g.current_user.id`. Pasa 200/404/409; lo demás → 502.

### 4.3 Tests — ampliar `backoffice-api/tests/test_service_requests.py`

- GET público: `my_quotation` null sin cotizar; con cotización propia la devuelve; con otra
  empresa elegida → `selected_other` y sin datos de esa otra; cancelada → `cancelled`.
- POST público: token inválido 404, vencido 410, nunca 401; reenvía con el `carrier_company_id`
  del token aunque el body traiga otro; pasa 400/409; red caída → 502 (mock de `requests.post`
  como los tests existentes).
- detalle admin: `quotations` ordenadas por monto, `total_amount` calculado con `PLATFORM_FEE`
  (setenv) o el congelado si está elegida.
- lista: `quotations_count` y `min_amount`.
- select: requiere admin (401/403); reenvía `admin_user_id` correcto.

## 5. Backoffice frontend (`backoffice/src/`)

### 5.1 Vista del transportista — `pages/service-requests/CarrierView.jsx`

Reemplazar la barra fija "Enviar mi precio por WhatsApp" por un **formulario de cotización**:
- Sección "Tu cotización" (al final de la página y anclada con un botón fijo abajo en mobile
  que hace scroll hasta ella):
  - Monto con prefijo `S/`, `inputMode="decimal"`, acepta coma o punto como separador
    (convertir `,` → `.` antes de enviar). Obligatorio.
  - Nota opcional (`textarea`, 500 caracteres, contador), placeholder
    "Ej. Incluye materiales, vamos 2 personas, demora 3 horas".
  - Botón "Enviar cotización" (o "Actualizar cotización" si ya existe). Al enviar: estado
    "Enviando…", y al terminar un aviso verde "Cotización enviada: S/ 350.00. Te avisaremos si
    te eligen." con la fecha de la última actualización.
  - Errores visibles en la página (no `alert()` ni `confirm()`), con textos en español según el
    `message` del servidor: monto inválido, solicitud ya asignada, cotización ya elegida,
    solicitud cancelada, sin conexión.
- Según `quotation_state`:
  - `open`: formulario (prellenado si hay `my_quotation`).
  - `selected_mine`: sin formulario; aviso "¡Te eligieron! Chalán te contactará para coordinar."
    con su monto.
  - `selected_other`: sin formulario; "Esta solicitud ya fue asignada a otro transportista."
  - `cancelled`: el aviso de cancelada que ya existe, sin formulario.
- El monto que ve el transportista es **solo el suyo**, sin comisión.
- Mantener un link secundario "¿Dudas? Escríbenos por WhatsApp" a `wa.me/51972643007`.
- Llamada con el `client` de axios existente (`/api/public/...`). El POST público no lleva login.

### 5.2 Detalle admin — `pages/service-requests/Detail.jsx`

Nueva sección **"Cotizaciones (N)"** entre "Fotos y videos" y "Transportistas":
- Tabla ordenada por monto: empresa, monto del transportista, **total para el cliente**, nota,
  última actualización, estado. La más barata con una marca "Más barata".
- Botón "Elegir" por fila (segundo clic de confirmación en línea, como la cancelación; **no**
  `confirm()`). La elegida queda resaltada con "Elegida" y su total congelado.
- Junto a la elegida:
  - "Copiar mensaje para el cliente": copia al portapapeles un texto listo, p. ej.
    `Hola, tenemos tu cotización de embalaje para el <día> en <distrito>: S/ <total>.
    ¿Confirmamos?` (total con comisión, formato `S/ 1,234.50`, fecha con `formatDay`).
  - El link "Abrir chat" con el WhatsApp del cliente que ya existe.
- Sin cotizaciones: "Aún no llegan cotizaciones."
- Debajo de la tabla, en gris: "El total incluye la comisión de Chalán (X%)." con el
  `platform_fee_rate` vigente.

### 5.3 Lista — `pages/service-requests/List.jsx`

Columnas nuevas "Cotizaciones" (`quotations_count`) y "Desde" (`min_amount`, `S/ …` o `—`).

## 6. Orden de implementación

1. Migración 019 + modelos en ambas apps.
2. API principal: lógica, endpoints internos, email/WhatsApp al admin, tests.
3. Backoffice API: público + admin, tests.
4. Backoffice frontend: vista del transportista, detalle, lista.
5. Verificación:
   - `pytest` completo en las dos APIs (dentro de los contenedores `chalan-flask-1` y
     `chalan-backoffice-api-1`: el Python del host no tiene Flask).
   - `npm run build` del backoffice (`docker exec chalan-backoffice-1 sh -c 'cd /app && npm run build'`).
   - Recorrido en el navegador contra la API local: cotizar desde el link del transportista,
     actualizar, verlo en el detalle, elegir, y ver los estados `selected_mine` / `selected_other`
     con dos empresas. Para no mandar correos reales desde local, probar con
     `NOTIFY_EMAIL` vacío o con los envíos mockeados; **borrar después** los datos de prueba.

Un commit por fase, en inglés, en la rama `feature/packing-quotations`. **No hacer push** ni
correr la suite de Playwright.

## 7. Despliegue (para Carlos)

Servicios que cambian: `flask-api` (endpoints y migración), `backoffice-api` (endpoints y
modelo) y `nginx` (el backoffice React vive en esa imagen). `services-web` y `nextjs` **no**.

1. `df -h /`; si queda poco disco, `sudo docker builder prune -f` antes de construir.
2. Builds de a uno: `flask-api`, `backoffice-api`, `nginx` (último).
3. **Migración 019 antes de reiniciar `backoffice-api`**:
   `$DC run --rm -e FLASK_APP=chalan.py flask-api flask db upgrade`.
4. `up -d flask-api`, luego `backoffice-api`, luego `nginx`.
5. Opcional: plantilla de WhatsApp para el admin ("<empresa> envió una cotización en Chalán.
   Revísala aquí: {{2}}") y su SID en `TWILIO_TEMPLATE_SERVICE_QUOTATION` de `.env.prod`
   (ojo con el `=`); después `up -d flask-api`. Sin ella solo llega el email.

## 8. Criterios de aceptación

- El transportista cotiza desde su link sin login, desde el celular, y puede corregir su monto
  hasta que el admin elija una cotización.
- El monto se guarda tal cual; el backoffice muestra el total con `PLATFORM_FEE`, y al elegir
  queda congelado aunque luego cambie la comisión.
- El admin recibe un email por cada cotización nueva o actualizada (WhatsApp solo por las
  nuevas, si hay plantilla).
- Elegir es exclusivo: solo una elegida por solicitud; elegir otra desmarca la anterior.
- Con una elegida, los demás transportistas ven "ya fue asignada" y no pueden cotizar; el elegido
  ve "te eligieron" y no puede cambiar su monto.
- La vista del transportista nunca muestra montos ni nombres de otras empresas, ni el WhatsApp
  del cliente.
- `orders`, `quotations` y el flujo de mudanza quedan sin cambios.
