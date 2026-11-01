'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { NON_MOVING_PATHS } from '@/lib/homeServices'
import { blogLayout, tagRecordings } from '@/lib/blogLayoutTest'

// Grupo de contenido de GA4 (dimensión estándar "Grupo de contenido"), para
// comparar el blog con el resto sin filtrar por URL.
function contentGroup(pathname: string) {
  if (pathname === '/') return 'home'
  if (pathname === '/blog') return 'blog_index'
  if (pathname.startsWith('/blog/')) return 'blog'
  if (pathname.startsWith('/transportistas')) return 'carriers'
  if (NON_MOVING_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return 'service'
  return 'landing'
}

// Categoría y fecha del post, que la página del post deja en su <article>
// (data-post-category, data-post-date). Solo en los posts.
function postParams() {
  const article = document.getElementById('blog-article')
  if (!article) return {}
  return {
    post_category: article.dataset.postCategory || undefined,
    post_date: article.dataset.postDate || undefined,
    blog_layout: blogLayout(),
  }
}

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
      const layout = blogLayout()
      if (layout) tagRecordings(layout)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gtag = (window as any).gtag
      if (typeof gtag !== 'function') return

      gtag('event', 'page_view', {
        page_path: pathname,
        // href y no pathname: lleva el query string, que es donde viajan los
        // ?ref= de los agentes y los utm_*.
        page_location: window.location.href,
        page_title: document.title,
        content_group: contentGroup(pathname),
        ...postParams(),
      })
    })

    return () => cancelAnimationFrame(frame)
  }, [pathname])

  return null
}
