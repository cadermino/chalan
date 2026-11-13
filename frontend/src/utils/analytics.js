// Gemelo de frontend-react/src/lib/analytics.ts: son dos apps distintas
// (landing en Next, flujo de orden en Vue) sobre la misma propiedad de GA4,
// así que el embudo solo cierra si ambas mandan los eventos igual.
//
// Envolver gtag evita dos cosas: que cada componente tenga que comprobar si
// GA cargó (en dev no existe, y los adblockers lo tumban en producción), y
// que un typo en el nombre de un evento pase desapercibido — en GA4 no
// falla nada, simplemente aparece un evento nuevo que nadie mira.

// Nunca mandes PII a GA (teléfono, email, dirección completa): además de ser
// dato personal, viola los términos de uso y pueden borrarte la propiedad.
export function track(event, params = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;

  // GA4 pinta los parámetros vacíos como "(not set)" en los informes, lo que
  // ensucia más de lo que aporta.
  const clean = {};
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value !== undefined && value !== null && value !== '') clean[key] = value;
  });

  window.gtag('event', event, clean);
}

// La versión del botón del cotizador que vio en la web (A/B de noviembre 2026,
// frontend-react/src/lib/ctaTextTest.ts), para medir si el texto nuevo trae
// órdenes y no solo clics. La cookie la pone la web; sin ella, nada.
export function ctaTextVersion() {
  const match = document.cookie.match(/(?:^|; )chalan_cta_ab=(continuar|comparar)(?:;|$)/);
  return match ? match[1] : undefined;
}

export default { track };
