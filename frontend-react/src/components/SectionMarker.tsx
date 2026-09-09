'use client'

import { useEffect, useRef } from 'react'
import { track } from '@/lib/analytics'

// Centinela invisible que se coloca en el MDX justo antes de una sección, y
// manda un evento cuando esa sección entra en pantalla.
//
// Existe por una pregunta concreta que quedó abierta en agosto y que ni las
// grabaciones de sesión ni el scroll nativo de GA4 podían responder de forma
// agregada: cuánta gente llega a la tabla de precios interprovinciales, y de
// esos cuántos siguen leyendo. Un porcentaje de scroll es un proxy de eso;
// esto mide la cosa misma, y no se desalinea cuando el post cambia de largo.
//
// Uso en MDX, con línea en blanco a cada lado:
//
//   <SectionMarker name="tabla_interprovincial" />
//
export function SectionMarker({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        track('section_viewed', { section: name })
        // Una vez por carga de página: interesa si llegó, no cuántas veces
        // pasó por encima al hacer scroll de ida y vuelta.
        observer.disconnect()
      })
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [name])

  return <span ref={ref} aria-hidden="true" style={{ display: 'block', height: 0 }} />
}
