import { useCallback, useEffect, useState } from 'react'
import client from '../api/client'

// "Activar avisos" en el link del transportista de servicios. Gemelo de
// frontend/src/components/carrierCompany/PushOptIn.vue (el link de mudanzas):
// registra el mismo service worker (/quotation/push-sw.js, que sirve la app de
// Vue), así una empresa que hace mudanzas y servicios tiene una sola suscripción
// por celular. Lo guarda el API principal (app/api/carrier_push.py) a través del
// backoffice-api, con el token del link. En local el backoffice corre en el 5173:
// vite.config.js le pide esos archivos a la app de Vue.
const SW_URL = '/quotation/push-sw.js'
const SW_SCOPE = '/quotation/'
const SW_TIMEOUT_MS = 10000
const DISMISS_KEY = 'chalan_push_dismissed_at'
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000

function base64UrlToBytes(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const raw = window.atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

function sameKey(buffer, key) {
  if (!buffer) return false
  const a = new Uint8Array(buffer)
  const b = base64UrlToBytes(key)
  return a.length === b.length && a.every((byte, i) => byte === b[i])
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// Web Push en iPhone existe desde iOS 16.4, y solo con el sitio en la pantalla de inicio.
function iosHasWebPush() {
  const match = navigator.userAgent.match(/OS (\d+)_(\d+)/)
  if (!match) return true
  const [major, minor] = [Number(match[1]), Number(match[2])]
  return major > 16 || (major === 16 && minor >= 4)
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function pushSupported() {
  return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function addHomeScreenLinks() {
  if (document.querySelector('link[rel="manifest"]')) return
  ;[['manifest', '/quotation/manifest.json'], ['apple-touch-icon', '/quotation/icon-192.png']].forEach(([rel, href]) => {
    const link = document.createElement('link')
    link.rel = rel
    link.href = href
    document.head.appendChild(link)
  })
}

function readDismissed() {
  try {
    const at = Number(window.localStorage.getItem(DISMISS_KEY))
    return Boolean(at) && Date.now() - at < DISMISS_MS
  } catch {
    return false
  }
}

async function registration() {
  const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE })
  if (reg.active) return reg
  const worker = reg.installing || reg.waiting
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('sw_timeout')), SW_TIMEOUT_MS)
    const done = () => { clearTimeout(timer); resolve(reg) }
    if (!worker) { done(); return }
    worker.addEventListener('statechange', () => { if (worker.state === 'activated') done() })
  })
}

function Bell() {
  return (
    <svg className="mt-0.5 h-6 w-6 flex-shrink-0 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  )
}

export default function PushOptIn({ token }) {
  const [state, setState] = useState('hidden')
  const [publicKey, setPublicKey] = useState(null)

  const save = useCallback((subscription) =>
    client.post(`/api/public/service-requests/${token}/push-subscription`, subscription.toJSON()), [token])

  useEffect(() => {
    let cancelled = false
    const show = (next) => { if (!cancelled) setState(next) }
    ;(async () => {
      let key
      try {
        key = (await client.get('/api/public/web-push/public-key')).data.public_key
      } catch {
        return
      }
      if (!key || cancelled) return
      setPublicKey(key)

      if (isIos() && !isStandalone()) {
        if (!iosHasWebPush()) return
        addHomeScreenLinks()
        if (!readDismissed()) show('ios_install')
        return
      }
      // Otro navegador sin avisos (o un Huawei sin Google, que falla al activar): sigue por WhatsApp.
      if (!pushSupported()) return
      if (Notification.permission === 'denied') { show('denied'); return }
      if (Notification.permission === 'granted') {
        try {
          const reg = await registration()
          const existing = await reg.pushManager.getSubscription()
          if (existing && sameKey(existing.options.applicationServerKey, key)) {
            // Lo vuelve a guardar: puede ser el link de otra empresa, o el buzón cambió.
            await save(existing)
            show('on')
            return
          }
        } catch {
          // Se ofrece de nuevo.
        }
      }
      if (!readDismissed()) show('ask')
    })()
    return () => { cancelled = true }
  }, [save])

  const dismiss = () => {
    try { window.localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* sin almacenamiento */ }
    setState('hidden')
  }

  const enable = async () => {
    setState('working')
    let permission
    try {
      permission = await Notification.requestPermission()
    } catch {
      permission = Notification.permission
    }
    if (permission !== 'granted') {
      setState(permission === 'denied' ? 'denied' : 'ask')
      return
    }
    try {
      const reg = await registration()
      let subscription = await reg.pushManager.getSubscription()
      if (subscription && !sameKey(subscription.options.applicationServerKey, publicKey)) {
        await subscription.unsubscribe()
        subscription = null
      }
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) })
      }
      await save(subscription)
      setState('on')
    } catch {
      setState('failed')
    }
  }

  if (state === 'hidden') return null

  if (state === 'ask' || state === 'working') {
    return (
      <div id="push-opt-in" className="flex items-start gap-3 rounded-lg border border-teal-200 bg-white p-4 shadow-sm">
        <Bell />
        <div className="flex-1">
          <p className="font-semibold text-gray-800">Recibe las solicitudes nuevas al instante</p>
          <p className="mt-1 text-sm text-gray-600">
            Te avisamos en este celular apenas entre una solicitud para cotizar, aunque tengas el navegador cerrado. El WhatsApp te sigue llegando igual.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <button
              id="push-enable"
              type="button"
              onClick={enable}
              disabled={state === 'working'}
              className="rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {state === 'working' ? 'Activando…' : 'Activar avisos'}
            </button>
            <button type="button" onClick={dismiss} disabled={state === 'working'} className="py-2 text-sm text-gray-500 underline hover:text-gray-700">
              Ahora no
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'ios_install') {
    return (
      <div id="push-ios-install" className="flex items-start gap-3 rounded-lg border border-teal-200 bg-white p-4 shadow-sm">
        <Bell />
        <div className="flex-1">
          <p className="font-semibold text-gray-800">Recibe las solicitudes nuevas al instante en tu iPhone</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-gray-600">
            <li>Toca <strong>Compartir</strong> en Safari (el cuadrado con la flecha).</li>
            <li>Elige <strong>"Agregar a pantalla de inicio"</strong>.</li>
            <li>Abre Chalán desde ese ícono y toca <strong>"Activar avisos"</strong>.</li>
          </ol>
          <button type="button" onClick={dismiss} className="mt-2 py-2 text-sm text-gray-500 underline hover:text-gray-700">
            Ahora no
          </button>
        </div>
      </div>
    )
  }

  if (state === 'on') {
    return <p id="push-on" className="text-sm text-green-700">Avisos activados en este celular.</p>
  }
  if (state === 'denied') {
    return (
      <p id="push-denied" className="text-sm text-gray-600">
        Bloqueaste los avisos de Chalán en este navegador. Para recibirlos, permítelos en la configuración del sitio (el candado junto a la dirección → Notificaciones).
      </p>
    )
  }
  return (
    <p id="push-failed" className="text-sm text-gray-600">
      Tu celular no puede recibir avisos de Chalán. Te seguimos escribiendo por WhatsApp.
    </p>
  )
}
