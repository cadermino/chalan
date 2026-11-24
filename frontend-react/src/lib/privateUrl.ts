// Varias URLs de Chalán llevan una credencial en la ruta: aquí el link de
// reseña (/reviews/submit/<token>, /r/), el de documentos del transportista
// (/transportistas/documentos/<token>), el pedido para cotizar (/v/<token>) y
// los cortos (/c/, /s/); en el Vue el acceso del cliente (/acceso/<token>) y
// los links de cotizar (/quotation/<JWT>, /carrier-company/order(s)/<JWT>); en
// services-web la página de cotizaciones de un servicio (/cotizaciones/<public_id>).
//
// gtag manda en cada evento la URL del navegador (dl) y la de la página
// anterior (dr), que en una página de Next puede ser una de esas del Vue.
// Hasta noviembre de 2026 GA4 guardaba esos tokens. Esto los cambia por
// ":token" antes de que salgan; también si vienen codificados en el query.
//
// Copias en frontend/src/utils/privateUrl.js y services-web/src/privateUrl.js:
// tests/test_private_urls_in_analytics.py compara las tres.
export const PRIVATE_SEGMENT = /((?:\/|%2F)(?:acceso|quotation|carrier-company(?:\/|%2F)orders?|reviews(?:\/|%2F)submit|transportistas(?:\/|%2F)documentos|cotizaciones|c|s|r|v)(?:\/|%2F))[^/?#&%]+/gi;

// Red de seguridad para un JWT en cualquier otra parte de la URL.
export const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;

export function withoutCredentials(url: string): string {
  if (!url) return url;
  return url.replace(PRIVATE_SEGMENT, '$1:token').replace(JWT, ':token');
}

// Lo que gtag usa para los eventos que manda solo (scroll, clics salientes) y
// para los que no traen page_location propio. PageViewTracker lo llama en
// cada cambio de ruta.
export function setAnalyticsLocation(href: string = window.location.href) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gtag = (window as any).gtag;
  if (typeof gtag !== 'function') return;
  const params: Record<string, string> = { page_location: withoutCredentials(href) };
  if (document.referrer) params.page_referrer = withoutCredentials(document.referrer);
  gtag('set', params);
}

// Lo mismo para el script del <head> (layout.tsx), que corre antes que
// cualquier componente: la página de entrada suele ser justo la del token.
export const PRIVATE_URL_SCRIPT = `(function(){
var clean=function(u){return u&&u.replace(${PRIVATE_SEGMENT},'$1:token').replace(${JWT},':token');};
var p={page_location:clean(location.href)};
if(document.referrer)p.page_referrer=clean(document.referrer);
gtag('set',p);
})();`;
