// Avisos push a transportistas (app/api/carrier_push.py, components/carrierCompany/PushOptIn.vue).
// Vive en /quotation/ para que su alcance sea solo el link de cotizar y no
// toque la web de Next ni el flujo de órdenes. Solo muestra avisos: no
// intercepta pedidos ni guarda nada en caché.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(self.registration.showNotification(data.title || 'Chalán', {
    body: data.body || '',
    icon: '/quotation/icon-192.png',
    tag: data.tag,
    // Con el mismo tag reemplaza al anterior de esa orden, pero vuelve a sonar.
    renotify: Boolean(data.tag),
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(self.clients.openWindow(url));
});
