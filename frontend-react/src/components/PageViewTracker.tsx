'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// GA4 solo manda un page_view al cargar gtag.js. Las navegaciones
// client-side del App Router no lo repiten, así que hasta ahora el landing
// dependía de la medición mejorada ("cambios de página según eventos del
// historial") para contar todo lo que no fuera la primera página.
//
// Esa opción también le disparaba un segundo page_view a cada navegación del
// flujo de orden en Vue, que ya manda el suyo desde el router: la misma
// navegación se contaba dos veces. Al apagarla, el landing se quedaba ciego
// si no mandaba el suyo. Esto lo manda.
export function PageViewTracker() {
  const pathname = usePathname()

  useEffect(() => {
    // Next actualiza el <title> al montar la ruta nueva, así que esperamos al
    // siguiente frame para no reportar el título de la página anterior.
    const frame = requestAnimationFrame(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gtag = (window as any).gtag
      if (typeof gtag !== 'function') return

      gtag('event', 'page_view', {
        page_path: pathname,
        // href y no pathname: lleva el query string, que es donde viajan los
        // ?ref= de los agentes y los utm_*.
        page_location: window.location.href,
        page_title: document.title,
      })
    })

    return () => cancelAnimationFrame(frame)
  }, [pathname])

  return null
}
