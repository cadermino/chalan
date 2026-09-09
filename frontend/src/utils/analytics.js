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

export default { track };
