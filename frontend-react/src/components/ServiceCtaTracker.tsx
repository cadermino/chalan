'use client'

import { useEffect } from 'react'
import { track } from '@/lib/analytics'
import { HOME_SERVICES } from '@/lib/homeServices'

// Manda `service_cta_click` cuando alguien toca un botón para cotizar un servicio
// a domicilio: el formulario de services-web o el WhatsApp. Es el primer paso
// del embudo de servicios en GA4; los siguientes los manda services-web
// (service_request_step_view, ...). Un solo listener en el layout en vez de un
// onClick por botón: los botones viven en páginas de servidor (landings, posts,
// nav, footer) y así ninguno nuevo se queda sin medir.
//
// - service: el código de lu_service_types.
// - channel: `form` o `whatsapp`.
// - placement: `nav`, `footer`, `home`, `blog`, `landing` u `other`.
//
// Los WhatsApp de mudanza no cuentan: sin servicio reconocible no se manda nada.

const FORM_SERVICES: Record<string, string> = {
  '/embalaje/cotizar': 'packing',
  '/armado/cotizar': 'furniture_assembly',
  '/pintura/cotizar': 'painting',
  '/porcelanato/cotizar': 'masonry',
  '/microcemento/cotizar': 'microcement',
}

const LANDING_SERVICES: Record<string, string> = {
  '/embalaje-profesional': 'packing',
  '/armado-de-muebles': 'furniture_assembly',
  ...Object.fromEntries(Object.values(HOME_SERVICES).map((s) => [s.path, s.code])),
}

// El texto prellenado dice qué servicio es (la caja del final de un post).
const WHATSAPP_TEXT_SERVICES: Record<string, string> = Object.fromEntries(
  Object.values(HOME_SERVICES).map((s) => [s.whatsappText, s.code]),
)

const isWhatsapp = (url: URL) => url.hostname === 'wa.me' || url.hostname.endsWith('whatsapp.com')

function placement(link: Element, pathname: string) {
  if (link.closest('nav')) return 'nav'
  if (link.closest('footer')) return 'footer'
  if (pathname === '/') return 'home'
  if (pathname.startsWith('/blog/')) return 'blog'
  if (LANDING_SERVICES[pathname]) return 'landing'
  return 'other'
}

export function ServiceCtaTracker() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[href]')
      if (!link) return
      let url: URL
      try {
        url = new URL((link as HTMLAnchorElement).href, window.location.href)
      } catch {
        return
      }
      const pathname = window.location.pathname.replace(/(.)\/$/, '$1')
      let channel: 'form' | 'whatsapp'
      let service: string | undefined
      if (url.origin === window.location.origin && FORM_SERVICES[url.pathname.replace(/\/$/, '')]) {
        channel = 'form'
        service = FORM_SERVICES[url.pathname.replace(/\/$/, '')]
      } else if (isWhatsapp(url)) {
        channel = 'whatsapp'
        service = WHATSAPP_TEXT_SERVICES[url.searchParams.get('text') ?? ''] ?? LANDING_SERVICES[pathname]
      } else {
        return
      }
      if (!service) return
      track('service_cta_click', { service, channel, placement: placement(link, pathname) })
    }
    // En captura: llega aunque un botón corte la propagación.
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return null
}
