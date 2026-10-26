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

// Inspectlet, la misma cuenta que la landing (Next) y el flujo de mudanza (Vue).
// Solo en producción. Sin CompressionStream (Safari < 16.4) no puede enviar nada,
// así que ni se carga.
const INSPECTLET_WID = 1681414770

export function initInspectlet() {
  if (!import.meta.env.PROD || typeof window.CompressionStream === 'undefined') return
  window.__insp = window.__insp || []
  window.__insp.push(['wid', INSPECTLET_WID])
  const script = document.createElement('script')
  script.async = true
  script.src = `https://cdn.inspectlet.com/inspectlet.js?wid=${INSPECTLET_WID}&r=${Math.floor(Date.now() / 3600000)}`
  document.head.appendChild(script)
}

const lastTagged = {}

// Etiqueta la grabación de Inspectlet y la de Clarity, como el Vue
// (frontend/src/utils/sessionTags.js): con el número de servicio del backoffice
// se filtra la visita del cliente. Solo ids, nunca el public_id (abre la
// solicitud), el WhatsApp ni la dirección.
export function tagSession(key, value) {
  if (value === null || value === undefined || value === '' || lastTagged[key] === value) return
  lastTagged[key] = value
  if (window.__insp && typeof window.__insp.push === 'function') window.__insp.push(['tagSession', { [key]: value }])
  if (typeof window.clarity === 'function') window.clarity('set', key, String(value))
}

const sentLabels = new Set()

// Etiqueta suelta, sin valor: varias se acumulan en la misma sesión (trabarse
// primero en un campo y después en otro). Igual que tagSessionLabel del Vue.
function tagSessionLabel(label) {
  if (sentLabels.has(label)) return
  sentLabels.add(label)
  if (window.__insp && typeof window.__insp.push === 'function') window.__insp.push(['tagSession', label])
  if (typeof window.clarity === 'function') window.clarity('set', label, '1')
}

// El cliente tocó "Siguiente" y no pudo pasar: qué faltaba (el nombre del
// campo, nunca su valor), como step_one_blocked en el flujo de mudanza. Con
// `network` o `server` el paso estaba bien y falló el guardado. En GA4 dice
// en qué se traban; en Inspectlet y Clarity deja encontrar esas grabaciones.
export function trackBlocked(service, step, missingFields) {
  const fields = [].concat(missingFields)
  track('service_request_blocked', { service, step, missing_field: fields[0], missing_count: fields.length })
  tagSessionLabel(`${step}_blocked:${fields[0]}`)
}

export const saveFailure = (err) => (err?.response ? 'server' : 'network')

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
