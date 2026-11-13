// A/B del blog (noviembre 2026): en computadora (≥1024 px), los posts de
// mudanza y flete se ven como siempre (`inline`: el cotizador dentro del texto
// y al final) o con el cotizador fijo en una columna a la derecha (`sidebar`).
// Métrica principal: sesiones con quote_widget_start sobre sesiones en esos
// posts; secundaria quote_cta_click. Hasta el 2026-11-30 (eran 2 semanas, pero
// en 11 días llegaron ~30 personas por versión), y no se decide antes. Al terminar se deja la que gane y se borra esto: este
// archivo, el script del <head> en layout.tsx, `data-blog-test` y las clases
// blog-* del post, las reglas de globals.css, y blogLayout()/tagRecordings() en
// PageViewTracker y analytics.ts.

export const BLOG_LAYOUT_COOKIE = 'chalan_blog_ab'

// Corre en el <head>, antes de pintar: la versión va en <html data-blog-layout>
// y el CSS hace el resto, así que no hay parpadeo y sirve también al llegar al
// post navegando (el <html> no se vuelve a pintar). La cookie la mantiene
// para la misma persona 90 días.
export const BLOG_LAYOUT_SCRIPT = `(function(){try{
var m=document.cookie.match(/(?:^|; )${BLOG_LAYOUT_COOKIE}=(inline|sidebar)(?:;|$)/);
var v=m?m[1]:(Math.random()<0.5?'inline':'sidebar');
if(!m)document.cookie='${BLOG_LAYOUT_COOKIE}='+v+'; path=/; max-age=7776000; SameSite=Lax';
document.documentElement.setAttribute('data-blog-layout',v);
}catch(e){}})();`

// La versión que ve quien está en un post del test con pantalla ancha, para
// mandarla con cada evento (`blog_layout`). En celular, o fuera de esos posts,
// nada: ahí las dos versiones son iguales.
export function blogLayout(): string | undefined {
  if (typeof window === 'undefined' || window.innerWidth < 1024) return undefined
  if (!document.querySelector('[data-blog-test]')) return undefined
  return document.documentElement.dataset.blogLayout || undefined
}

// La misma versión en las grabaciones de Inspectlet (tag `blog_layout`) y
// Clarity (etiqueta personalizada `blog_layout`), para ver cada una por
// separado. Si sus scripts todavía no cargaron, deja el pedido en sus colas
// (el mismo arranque que usan sus snippets en layout.tsx), y lo toman al cargar.
export function tagRecordings(layout: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  w.__insp = w.__insp || []
  w.__insp.push(['tagSession', { blog_layout: layout }])
  w.clarity = w.clarity || function () {
    // eslint-disable-next-line prefer-rest-params
    (w.clarity.q = w.clarity.q || []).push(arguments)
  }
  w.clarity('set', 'blog_layout', layout)
}
