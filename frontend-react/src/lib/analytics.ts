// Capa fina sobre gtag.js. Existe por dos razones: que ningún componente
// tenga que acordarse de comprobar si GA cargó (adblockers y dev lo dejan
// sin definir), y que los nombres de los eventos del embudo vivan en un
// solo sitio — un typo en un `gtag('event', ...)` suelto no falla, solo
// crea un evento nuevo en GA4 que nadie mira.

// El measurement ID no es secreto (viaja en el HTML de todas formas). El
// default hace que producción siga funcionando sin tocar el Dockerfile;
// NEXT_PUBLIC_GA_ID solo hace falta para apuntar a otra propiedad o para
// encender GA en local y validar en DebugView.
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-72KVLDWMQD';

// Fuera de producción GA solo se enciende si se pide explícitamente, para
// que el tráfico de `next dev` no ensucie los informes.
export const GA_ENABLED =
  process.env.NODE_ENV === 'production' || !!process.env.NEXT_PUBLIC_GA_ID;

export const GA_DEBUG = process.env.NODE_ENV !== 'production';

// Eventos del embudo de la landing. Los del flujo de orden viven en el Vue
// (frontend/src/utils/analytics.js) porque son apps distintas sobre la
// misma propiedad de GA.
export type LandingEvent =
  | 'quote_widget_start'
  | 'quote_estimated'
  | 'quote_cta_click'
  | 'scroll_depth'
  | 'section_viewed';

type Params = Record<string, string | number | boolean | null | undefined>;

export function track(event: LandingEvent, params: Params = {}) {
  if (typeof window === 'undefined') return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gtag = (window as any).gtag;
  if (typeof gtag !== 'function') return;

  // GA4 muestra los parámetros vacíos como "(not set)" en los informes, lo
  // que cuesta más de lo que aporta: mejor no mandarlos.
  const clean: Record<string, string | number | boolean> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') clean[key] = value;
  });

  gtag('event', event, clean);
}
