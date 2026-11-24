// Varias URLs de Chalán llevan una credencial en la ruta: el link de acceso del
// cliente (/acceso/<token>, abre su orden con sesión), los links de cotizar del
// transportista (/quotation/<JWT>, /carrier-company/order(s)/<JWT>), los de
// reseña, documentos y pedido para cotizar de Next (/reviews/submit/, /r/,
// /transportistas/documentos/, /v/), los cortos (/c/, /s/) y la página de
// cotizaciones de un servicio (/cotizaciones/<public_id>).
//
// gtag manda en cada evento la URL del navegador (dl) y la de la página
// anterior (dr). Hasta noviembre de 2026 GA4 guardaba esos tokens, y cualquiera
// con acceso a la propiedad podía abrir esas órdenes. Esto los cambia por
// ":token" antes de que salgan; también si vienen codificados en el query
// (?redirect=%2Facceso%2F...).
//
// Copias en frontend-react/src/lib/privateUrl.ts y services-web/src/privateUrl.js:
// tests/test_private_urls_in_analytics.py compara las tres.
export const PRIVATE_SEGMENT = /((?:\/|%2F)(?:acceso|quotation|carrier-company(?:\/|%2F)orders?|reviews(?:\/|%2F)submit|transportistas(?:\/|%2F)documentos|cotizaciones|c|s|r|v)(?:\/|%2F))[^/?#&%]+/gi;

// Red de seguridad para un JWT en cualquier otra parte de la URL.
export const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;

export function withoutCredentials(url) {
  if (!url) return url;
  return String(url).replace(PRIVATE_SEGMENT, '$1:token').replace(JWT, ':token');
}

// Lo que gtag usa para los eventos que manda solo (scroll, clics salientes) y
// para los que no traen page_location propio. Se llama al cargar y en cada
// cambio de ruta.
export function setAnalyticsLocation(href = window.location.href) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  const params = { page_location: withoutCredentials(href) };
  if (document.referrer) params.page_referrer = withoutCredentials(document.referrer);
  window.gtag('set', params);
}
