'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { track } from '@/lib/analytics'

const MILESTONES = [25, 50, 75, 90] as const

// El evento `scroll` nativo de GA4 dispara una sola vez, al 90%, así que en un
// post largo solo distingue "llegó casi al final" de nada. La pregunta que
// importa en los posts de precios es la contraria — dónde se detienen — y para
// eso hace falta la curva, no un binario al final.
//
// Esto es la red genérica de todo el sitio. Para los dos posts que traen el 88%
// del tráfico, SectionMarker mide lo mismo pero por sección concreta, que es
// más directo de leer.
export function ScrollDepth() {
  const pathname = usePathname()

  useEffect(() => {
    // Un Set por página: en una SPA el componente no se vuelve a montar entre
    // rutas, así que sin reiniciar aquí la segunda página nunca reportaría.
    const fired = new Set<number>()
    let ticking = false

    const measure = () => {
      ticking = false

      const doc = document.documentElement
      const scrollable = doc.scrollHeight - window.innerHeight

      // Página que entra entera en pantalla: se vio completa, cuenta como 90.
      const percent = scrollable <= 0
        ? 100
        : ((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100

      MILESTONES.forEach((milestone) => {
        if (percent >= milestone && !fired.has(milestone)) {
          fired.add(milestone)
          track('scroll_depth', { percent: milestone })
        }
      })
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(measure)
    }

    // Medir al montar también: hay páginas cortas donde no hay ningún scroll.
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [pathname])

  return null
}
