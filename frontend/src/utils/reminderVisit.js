import storage from './safeStorage';

// El cliente que entró por un recordatorio del backoffice (/acceso/<token>?r=whatsapp):
// lo recuerda este navegador unos días, para que elegir y agendar esa orden
// lleguen a GA4 con `reminder` y se sepa si el recordatorio sirvió.
const KEY = 'chalan_reminder_visit';
const DAYS = 14;

export function rememberReminderVisit(orderId, channel) {
  storage.setItem(KEY, JSON.stringify({ order_id: Number(orderId), channel, at: Date.now() }));
}

export function reminderChannel(orderId) {
  try {
    const visit = JSON.parse(storage.getItem(KEY) || 'null');
    if (!visit || visit.order_id !== Number(orderId)) return undefined;
    if (Date.now() - visit.at > DAYS * 86400000) return undefined;
    return visit.channel;
  } catch (e) {
    return undefined;
  }
}
