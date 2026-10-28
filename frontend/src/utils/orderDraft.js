// La mudanza que se está pidiendo vive en el localStorage (currentOrder,
// orderDetailsOrigin, orderDetailsDestination, services) para no perderla al
// recargar o al volver más tarde. Nada la borraba: el cliente que volvía
// semanas después traía su mudanza anterior, y al empezar otra el paso 1 le
// mandaba el PUT a esa (403 si la sesión había vencido, o peor, la reescribía).
// Al entrar al paso 1 se descarta la que ya no es un borrador.

export const ORDER_SECTIONS = ['currentOrder', 'orderDetailsOrigin', 'orderDetailsDestination', 'services'];
export const DRAFT_SAVED_AT = 'orderDraftSavedAt';
export const DRAFT_MAX_AGE_DAYS = 5;
// Mismo id que lu_order_status (CLAUDE.md, Order Statuses).
const PENDING = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

function read(storage, key) {
  try {
    return JSON.parse(storage.getItem(key) || 'null');
  } catch (e) {
    return null;
  }
}

function localDay(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Por qué ya no sirve lo guardado, o null si se puede seguir con eso.
export function staleDraftReason(storage, now = new Date()) {
  const order = read(storage, 'currentOrder');
  if (!order) return null;
  if (order.order_id && order.order_status_id && Number(order.order_status_id) !== PENDING) {
    return 'not_pending';
  }
  // appointment_date es 'YYYY-MM-DD HH:00:00' en hora de Lima.
  if (order.appointment_date && String(order.appointment_date).slice(0, 10) < localDay(now)) {
    return 'date_passed';
  }
  // Borradores de antes de DRAFT_SAVED_AT: cuenta desde que se creó la orden.
  const savedAt = Number(storage.getItem(DRAFT_SAVED_AT)) || Date.parse(order.created_date) || null;
  if (savedAt && now.getTime() - savedAt > DRAFT_MAX_AGE_DAYS * DAY_MS) {
    return 'too_old';
  }
  return null;
}
