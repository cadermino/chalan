# Plan: reserva con Yape obligatoria para agendar

> Plan para implementar. Alcance: **Perú solamente** (el flujo Vue es el de Perú; no tocar
> nada propio de chalan.mx: `Dockerfile.nginx.prod`, `docker-compose.prod.yml`, Stripe).
> Antes de cada paso, releer el código citado: los números de línea pueden haber cambiado.

## 1. Objetivo

Hoy el modal de pago muestra un QR de Yape como reserva **opcional** y "Agendar vehículo"
pone la orden en `in_progress` al instante. Se cambia a:

1. Para agendar, el cliente **tiene que** yapear la reserva y escribir el **número de operación**.
2. Al enviarlo se guarda el número, se avisa a operaciones por correo con los datos del pago y
   al cliente que su pago está en verificación. La orden **sigue en `pending`**.
3. Cuando un admin marca la reserva como pagada en el backoffice, la orden pasa a
   `in_progress` y recién ahí salen el correo al transportista y el de "Hemos agendado tu
   mudanza" al cliente.

### Decisiones ya tomadas (no reabrir)

- **La orden pasa a `in_progress` solo cuando un admin confirma la reserva en el backoffice**,
  no cuando el cliente escribe el número.
- **Solo se pide el número de operación.** No se pide el código de seguridad (3 dígitos, se
  repite, no identifica el pago).
- **También en la página pública del transportista** (`CarrierCompany.vue`), que abre el mismo
  modal para agendar. Si no, por ahí se agenda sin pagar.
- **Sin migración.** Todo lo necesario ya existe: `payments.reference` ("Nro. de operación
  Yape"), `payments.concept = 'reservation'`, `paid_at`, `confirmed_by_admin_id`, el
  `lu_payment_type` `yape` y el `PATCH` del backoffice que marca un pago como pagado.
- **No se piden datos de comprobante** (boleta/factura, DNI, RUC). Fuera de este plan.
- **Se mantiene la URL `PUT /api/v1/order/checkout-cash/:order_id`.** No renombrar.
- Las órdenes **sin** reserva (reserva = 0, o exigencia apagada) siguen como hoy: pasan a
  `in_progress` y mandan los correos al agendar.

## 2. Contexto del código actual (leer antes de empezar)

- `frontend/src/components/PaymentConfirmationModal.vue` — modal. Prop `showYapeQr`, computed
  `yapeQrVisible` (`showYapeQr && currency === 'PEN' && VUE_APP_YAPE_QR_ENABLED === 'true' &&
  reservationAmount > 0`), `reservationAmount = total_amount - amount`. Método
  `confirmCashCheckout()` llama a `chalan.checkoutCash()`.
- `frontend/src/views/order/Step-three.vue` — monta el modal **con** `show-yape-qr`.
- `frontend/src/components/carrierCompany/CarrierCompany.vue` — monta el modal **sin**
  `show-yape-qr`.
- `frontend/src/api/chalan.js` — `checkoutCash()` hace el PUT con body `{}`.
- `app/api/orders.py` → `generate_checkout_cash()` — llama a
  `OrderEntity.create_order_payments()`; si `created`, pone la orden en `in_progress` y manda
  `email/admin_new_order` al transportista (bcc ops) y `email/cash_payment_selected` al cliente.
- `app/api/order/order.py` → `create_order_payments()` — crea `carrier_cash` y `reservation`
  (ambas `pending`), idempotente por `quotation_id`, cancela las filas de una cotización anterior.
- `backoffice-api/app/api/orders.py` → `update_order_payment()` (`PATCH
  /orders/:id/payments/:payment_id`) — marca `paid`/`pending`/`cancelled`, acepta `reference`.
  Para llamar al main API usa `INTERNAL_API_URL` + `_internal_headers()` (ver
  `notify_carriers`, patrón a copiar).
- `app/api/orders.py` → `notify_carriers()` — ejemplo de endpoint interno con
  `is_internal_request()`.
- `backoffice/src/pages/orders/Detail.jsx` → `PaymentsCard` — lista los pagos; **no** muestra
  `reference`.
- **`VUE_APP_YAPE_QR_ENABLED` solo existe en `frontend/.env.development`.** En producción el QR
  hoy no se muestra. El build de Perú es `Dockerfile.nginx.peru.prod` (stage
  `vue-build-stage`, `COPY /frontend .` + `npm run build`).

## 3. Cambios

### 3.1 Flag de exigencia

- Frontend: se reutiliza `VUE_APP_YAPE_QR_ENABLED`. Activarlo en el build de Perú agregando
  `ENV VUE_APP_YAPE_QR_ENABLED=true` en el stage de Vue de `Dockerfile.nginx.peru.prod` (antes
  de `npm run build`). No tocar `Dockerfile.nginx.prod` (México).
- Backend: nueva variable `YAPE_RESERVATION_REQUIRED` (`'true'` para activar). Agregarla a
  `.env.dev` en `true`. Para Perú prod, **no editar `.env.prod`**: dejar anotado en el resumen
  final que hay que agregarla en el servidor.
- Helper en el main API, p. ej. en `app/api/order/order.py`:
  `def yape_reservation_required(): return os.getenv('YAPE_RESERVATION_REQUIRED') == 'true'`.

### 3.2 Modal — `PaymentConfirmationModal.vue`

- Bloque Yape: quitar "(opcional)". Título "Yapea tu reserva para agendar". Texto: "Yapea
  **S/ X** para agendar. El resto (S/ Y) lo pagas en efectivo al transportista el día de la
  mudanza."
- Debajo del QR (y del enlace de descarga en móvil), campo obligatorio:
  - Label "Número de operación" con `*` rojo (mismo estilo que el teléfono).
  - `inputmode="numeric"`, `autocomplete="off"`, placeholder tipo "Ej. 12345678".
  - Ayuda chica: "Lo ves en el comprobante de Yape después de yapear."
  - Nuevo campo `operationNumber` en `data()`. Resetearlo en el watcher de `quotation` cuando
    cambia el id (igual que `error`).
- `confirmCashCheckout()`:
  - Si `yapeQrVisible`: limpiar el valor (`replace(/\D/g, '')`). Vacío →
    `error = 'ingresa el número de operación de tu yapeo'` y return, antes de llamar a nada.
    Validar solo dígitos y 4 a 20 caracteres (no conocemos el largo exacto del número de
    Yape; no ser más estrictos).
  - Pasar `operationNumber` a `chalan.checkoutCash()` (solo si `yapeQrVisible`).
  - Manejar las respuestas del backend: 400 → "revisa el número de operación"; 409 → "ese
    número de operación ya se usó en otra orden". Cualquier otro error → el mensaje genérico de
    hoy.
  - **Ojo con el guard `cashPaymentCreated`**: si el primer intento falló con 400/409, no debe
    quedar en `true` (hoy se pone en `true` después de que el request responde bien, mantenerlo
    así).
  - Mensaje de éxito en el dashboard:
    - Con reserva: "Recibimos tu número de operación. Verificaremos tu pago y te confirmaremos
      el agendamiento por correo."
    - Sin reserva: el de hoy ("Muy bien, tu vehículo ha sido agendado!").
  - `payment_method` del store y de `track('order_confirmed')`: `'yape_reservation'` cuando
    hubo reserva, `'cash'` si no. El evento sigue disparándose solo si `checkoutCreated`.
- El aviso "El pago es en efectivo, directo al transportista." se mantiene solo cuando
  `!yapeQrVisible` (ya es así).
- Actualizar los comentarios del bloque Yape que dicen "opcional" / "no bloquea la
  confirmación" / "nada aquí marca la orden como pagada" para que describan el flujo nuevo.

### 3.3 Página del transportista — `CarrierCompany.vue`

- Agregar `show-yape-qr` al `<PaymentConfirmationModal>`.
- Actualizar el comentario del prop `showYapeQr` en el modal (hoy dice que en la vista del
  transportista el QR no tiene sentido; esa vista es la página pública donde el **cliente**
  agenda con un transportista). Verificar en `CarrierCompany.vue` que el modal se abre solo
  para un cliente logueado con orden (ver `openPaymentModal` / `showPaymentModal = true`);
  si no es así, avisar en el resumen en vez de forzarlo.

### 3.4 API del frontend — `frontend/src/api/chalan.js`

- `checkoutCash(payload)`: body `{ operation_number: payload.operationNumber }` cuando venga;
  `{}` si no.

### 3.5 Backend — checkout (`app/api/orders.py` → `generate_checkout_cash`)

Orden de operaciones:

1. Leer `operation_number` del JSON (`request.get_json(silent=True) or {}`), `str()`, quitar
   todo lo que no sea dígito.
2. Calcular si esta orden requiere reserva: `yape_reservation_required()` **y** la reserva de
   la cotización seleccionada es > 0. Calcular el monto con la **misma fórmula** que
   `create_order_payments()` (extraer a un helper compartido, p. ej.
   `OrderEntity.reservation_breakdown(quotation)` que devuelva `carrier_amount`, `total`,
   `reservation_amount`, y usarlo en ambos lugares; no duplicar la fórmula).
3. Si requiere reserva:
   - Número vacío o fuera de 4–20 dígitos → `400 {'message': 'invalid_operation_number'}`.
     No crear pagos ni tocar la orden.
   - Si existe un `Payment` con `concept='reservation'`, `status != 'cancelled'`,
     `reference == número` y `order_id != order_id` → `409 {'message':
     'operation_number_already_used'}`.
4. `create_order_payments(reference=número_o_None)`:
   - Al crear la fila `reservation`, guardar `reference`.
   - En la rama `existing` (ya agendada, `created=False`): si hay una reserva `pending` de esa
     cotización, actualizar su `reference` con el número recibido (el cliente pudo reintentar
     con el número corregido). Si ya está `paid`, no tocarla.
5. Si `created`:
   - **Requiere reserva** → **NO** cambiar el estado de la orden. Mandar:
     - Correo a operaciones (nueva plantilla `email/yape_reservation_submitted`, ver 3.7). Para:
       `OPS_MAIL` si `FLASK_ENV == 'prod'`, si no `ADMIN_MAIL` (mismo criterio que el bcc de hoy).
     - Correo al cliente (nueva plantilla `email/yape_reservation_received`): "Recibimos tu
       pago, lo estamos verificando".
     - **No** mandar `admin_new_order` al transportista ni `cash_payment_selected` (salen al
       confirmar, 3.6).
   - **No requiere reserva** → comportamiento actual intacto (estado `in_progress` + los dos
     correos de hoy).
   - Mover el envío de los correos "de agendado" (transportista + cliente) a una función
     reutilizable, p. ej. `_send_order_scheduled_emails(order_id)`, para llamarla desde aquí y
     desde 3.6.
6. Respuesta: agregar `'awaiting_verification': bool` además de `payment` y `created`.

### 3.6 Backend — confirmar la reserva

**Main API** — nuevo endpoint interno `POST /api/v1/order/<order_id>/confirm-reservation`
(en `app/api/orders.py`, junto a `notify_carriers`):

- `if not is_internal_request(): return 403`.
- Orden inexistente → 404.
- Si la orden está en `pending`: pasarla a `in_progress`, commit, y llamar a
  `_send_order_scheduled_emails(order_id)` (transportista + cliente). En el correo al cliente
  agregar los datos de la reserva (monto y número de operación) — ver 3.7.
- Si ya no está en `pending` (ya confirmada, completada o cancelada): no hacer nada.
- Responder `{'confirmed': True/False}` según si hubo transición. Idempotente: llamar dos veces
  no reenvía correos.

**Backoffice API** — en `update_order_payment()`:

- Después del commit, si `payment.concept == 'reservation'` y el nuevo estado es `paid`, llamar
  al endpoint interno de arriba (mismo patrón que `notify_carriers`: `INTERNAL_API_URL`,
  `_internal_headers()`, `timeout=30`).
- Si el main API falla o no responde: **no revertir el pago**. Devolver el pago igual, con un
  campo extra `'order_confirmation': 'failed'` para que el frontend avise. Si respondió bien,
  `'order_confirmation': 'ok'` (o `'unchanged'` si `confirmed` vino `False`).
- Revertir a `pending` o `cancelled`: **no tocar el estado de la orden** automáticamente (el
  transportista ya pudo recibir el correo). Se resuelve a mano desde Editar orden. Dejarlo
  dicho en un comentario.
- `POST /orders/:id/payments` (registrar pagos a mano con `reservation_paid`): **no cambiar**
  en este plan.

### 3.7 Correos (main API, `app/templates/email/`)

Copiar la estructura HTML de `cash_payment_selected.html` (mismo layout, logo, estilos).

- `yape_reservation_submitted.html` (operaciones). Asunto: `[Yape por verificar] Orden {id}`.
  Contenido: número de orden, cliente (nombre, email, teléfono), transportista, monto de la
  reserva (S/ con 2 decimales), **número de operación**, fecha y hora del envío (hora de Lima),
  y un botón/enlace al detalle de la orden en el backoffice:
  `{SITE_URL}backoffice/orders/{id}` (revisar cómo se arma `SITE_URL` en el resto del código,
  con o sin barra final).
- `yape_reservation_received.html` (cliente). Asunto: "Recibimos tu pago". Contenido: monto
  yapeado, número de operación, que lo estamos verificando y que le avisaremos por correo
  cuando quede agendada; lo que pagará en efectivo al transportista (S/ carrier_amount).
- `cash_payment_selected.html` (cliente, sale al confirmar): agregar un bloque opcional
  (`{% if reservation_amount %}`) con el monto de la reserva pagada, el número de operación y
  el saldo en efectivo. Sin esas variables, el correo queda como hoy (órdenes sin reserva).

### 3.8 Backoffice — `backoffice/src/pages/orders/Detail.jsx`

- En `PaymentsCard`, mostrar `p.reference` junto a la reserva ("N.º de operación: 12345678")
  cuando exista. Verificar que `Payment.to_dict()` del backoffice-api incluya `reference`;
  agregarlo si falta.
- Tras marcar como pagada, si la respuesta trae `order_confirmation === 'failed'`, mostrar un
  aviso: "El pago quedó registrado, pero la orden no se pudo poner en progreso. Hazlo desde
  Editar orden." Si es `'ok'`, refrescar el estado de la orden en la vista.

### 3.9 Tests — `tests/test_orders.py`

Ajustar los dos tests existentes y agregar (mismo setup que
`test_cash_checkout_moves_the_order_to_in_progress`):

- `test_cash_checkout_without_required_reservation_moves_to_in_progress` — el test actual,
  con `YAPE_RESERVATION_REQUIRED` sin setear: sigue pasando a `in_progress`.
- `test_checkout_requires_operation_number` — flag en `true`, sin número → 400, orden sigue
  `pending`, no se crean pagos.
- `test_checkout_with_operation_number_keeps_order_pending` — flag en `true`, con número →
  200, `created=True`, `awaiting_verification=True`, reserva con `reference` guardado y
  `pending`, orden en `pending`. Capturar los `send_email` con un monkeypatch que guarde las
  llamadas: sale el de operaciones y el `yape_reservation_received`; **no** sale
  `admin_new_order`.
- `test_checkout_rejects_reused_operation_number` — mismo número en una segunda orden → 409.
- `test_checkout_retry_updates_pending_reference` — segunda llamada con otro número →
  `created=False` y `reference` actualizado.
- `test_confirm_reservation_moves_order_to_in_progress` — llamada interna a
  `confirm-reservation` (ver cómo `test_orders.py` / `test_carrier_declines.py` arman los
  headers internos) → `in_progress`, salen los correos de agendado; segunda llamada →
  `confirmed=False`, sin correos.
- `confirm-reservation` sin token interno → 403.
- `test_cash_checkout_is_idempotent`: enviar número con el flag activo y ajustar el estado
  esperado a `pending`.

Correr la suite de la API (`pytest` dentro del contenedor `flask`, o como la corre
`make deploy-peru`). **No correr Playwright/e2e.** Compilar los frontends que se toquen
(`cd frontend && npm run lint && npm run build`, `cd backoffice && npm run build`).

## 4. Fuera de alcance (no implementar)

- Pedir datos de comprobante (boleta/factura, DNI, RUC) o emitir comprobantes.
- Cambiar cualquier cálculo de IGV, fee o total.
- Verificación automática del yapeo (Android/notificaciones, Culqi). Sigue siendo manual.
- Que el cliente vea "pago en verificación" en su dashboard (solo cambia el mensaje de éxito).
- Qué pasa si, con la reserva por verificar, el cliente elige otra cotización (la orden sigue
  `pending` y `quotations.py` lo permite; `create_order_payments` cancela la reserva anterior).
  Lo resuelve operaciones a mano.
- Cambiar el estado de la orden al revertir o cancelar una reserva.
- Registrar pagos a mano desde el backoffice (`POST /orders/:id/payments`).

## 5. Al terminar

- **No hacer push ni deploy.** Commit local está bien si se pide.
- En el resumen final listar: variable `YAPE_RESERVATION_REQUIRED=true` a agregar en el `.env`
  de Perú en el servidor; que el QR pasa a verse en producción Perú por el cambio del
  Dockerfile; y cualquier cosa de este plan que no se pudo hacer tal cual.
