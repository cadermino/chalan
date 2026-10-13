// Misma propiedad de GA4 que la landing y el flujo de mudanza (ver
// frontend/src/utils/analytics.js), así el embudo se lee de punta a punta.
//
// Nunca mandes PII a GA (WhatsApp, dirección): además de ser dato personal,
// viola los términos de uso y pueden borrarte la propiedad.
const DEFAULT_GA_ID = 'G-72KVLDWMQD'

export function initAnalytics() {
  // En local no hay GA salvo que se pida con VITE_GA_ID (para probar en DebugView).
  const gaId = import.meta.env.VITE_GA_ID
  if (!import.meta.env.PROD && !gaId) return
  const id = gaId || DEFAULT_GA_ID

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    window.dataLayer.push(arguments)
  }
  window.gtag('js', new Date())
  // send_page_view apagado: es una SPA y cada pantalla manda el suyo (pageView).
  window.gtag('config', id, { send_page_view: false, debug_mode: !import.meta.env.PROD })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`
  document.head.appendChild(script)
}

// Microsoft Clarity, mismo proyecto que la landing (Next) y el flujo de mudanza
// (Vue): así una visita que llega desde un post y sigue al formulario queda en
// una sola grabación. Solo en producción, para no grabar el entorno local.
// Los campos con datos personales llevan data-clarity-mask en el JSX.
//
// Ojo, aprendido en el Next: el <script> no puede llevar id="clarity". El
// navegador expone los elementos con id como globales, window.clarity pasaba a
// ser el <script>, el snippet lo daba por cargado y Clarity nunca arrancaba.
const CLARITY_PROJECT_ID = 'wa41vtag57'

export function initClarity() {
  if (!import.meta.env.PROD) return
  window.clarity = window.clarity || function clarity() {
    (window.clarity.q = window.clarity.q || []).push(arguments)
  }
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`
  document.head.appendChild(script)
}

// Los adblockers tumban gtag: envolverlo evita que un bloqueador rompa el formulario.
export function track(event, params = {}) {
  if (typeof window.gtag !== 'function') return
  const clean = {}
  Object.keys(params).forEach((key) => {
    const value = params[key]
    if (value !== undefined && value !== null && value !== '') clean[key] = value
  })
  window.gtag('event', event, clean)
}

export function pageView(path) {
  track('page_view', { page_path: path, page_location: window.location.origin + path })
}
