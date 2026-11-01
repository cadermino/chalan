// A/B del blog (noviembre 2026): en computadora (≥1024 px), los posts de
// mudanza y flete se ven como siempre (`inline`: el cotizador dentro del texto
// y al final) o con el cotizador fijo en una columna a la derecha (`sidebar`).
// Métrica principal: sesiones con quote_widget_start sobre sesiones en esos
// posts; secundaria quote_cta_click. 2 semanas o 500 visitas por versión, y no
// se decide antes. Al terminar se deja la que gane y se borra esto: este
// archivo, el script del <head> en layout.tsx, `data-blog-test` y las clases
// blog-* del post, y las reglas de globals.css.

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
