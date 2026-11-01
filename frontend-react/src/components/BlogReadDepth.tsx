'use client'

import { useEffect } from 'react'
import { track } from '@/lib/analytics'

const MARKS = [25, 50, 75, 100]

// Manda blog_read_depth cuando el lector pasa el 25, 50, 75 y 100 % del texto
// del post (#blog-article, no la página: el pie y el cotizador no cuentan).
// La medición mejorada de GA4 solo avisa al 90 % de la página, y con eso no se
// ve dónde se van. Cada marca una vez por visita al post.
export function BlogReadDepth({ category }: { category: string }) {
  useEffect(() => {
    const article = document.getElementById('blog-article')
    if (!article) return
    const sent = new Set<number>()
    let frame = 0

    const check = () => {
      frame = 0
      const { top, height } = article.getBoundingClientRect()
      if (height <= 0) return
      const read = ((window.innerHeight - top) / height) * 100
      MARKS.forEach((mark) => {
        if (read >= mark && !sent.has(mark)) {
          sent.add(mark)
          track('blog_read_depth', { percent: mark, post_category: category })
        }
      })
      if (sent.size === MARKS.length) window.removeEventListener('scroll', onScroll)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    check()
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [category])

  return null
}
