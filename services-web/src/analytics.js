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
