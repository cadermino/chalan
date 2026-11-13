// A/B del texto del botón del cotizador (noviembre 2026): "Continuar con esta
// cotización" (`continuar`, el de siempre) contra "Comparar precios de
// transportistas" con "Sin compromiso · Te avisamos por WhatsApp cuando
// lleguen" debajo (`comparar`). En todo el sitio y en cualquier pantalla,
// sorteado aparte del A/B del blog (otra cookie), así que no se mezclan.
// Métrica principal: personas con quote_cta_click sobre personas con
// quote_widget_start, por `cta_text`; de control, order_created (Vue lee la
// misma cookie): más clics que no crean orden no es mejora. 6 semanas o 170
// personas por versión, y no se decide antes. Al terminar se deja el ganador y
// se borra esto: este archivo (y su tagCtaText en QuoteWidget), su script en layout.tsx, las reglas
// html[data-cta-text] de globals.css, el texto perdedor en QuoteWidget,
// ctaText() en analytics.ts y ctaTextVersion() en el Vue (utils/analytics.js).

export const CTA_TEXT_COOKIE = 'chalan_cta_ab'

// Corre en el <head>, antes de pintar: los dos textos están en el HTML y el
// CSS muestra uno según <html data-cta-text>, así que no hay parpadeo ni
// diferencia de hidratación. Sin el script se ve el de siempre.
export const CTA_TEXT_SCRIPT = `(function(){try{
var m=document.cookie.match(/(?:^|; )${CTA_TEXT_COOKIE}=(continuar|comparar)(?:;|$)/);
var v=m?m[1]:(Math.random()<0.5?'continuar':'comparar');
if(!m)document.cookie='${CTA_TEXT_COOKIE}='+v+'; path=/; max-age=7776000; SameSite=Lax';
document.documentElement.setAttribute('data-cta-text',v);
}catch(e){}})();`

export function ctaText(): string | undefined {
  if (typeof document === 'undefined') return undefined
  return document.documentElement.dataset.ctaText || undefined
}

// La versión en la grabación de Inspectlet (tag `cta_text`) y de Clarity, al
// empezar a usar el cotizador: así se ven por separado las sesiones de cada
// texto. Si sus scripts no cargaron, el pedido queda en sus colas, como en
// tagRecordings() del A/B del blog.
export function tagCtaText() {
  const version = ctaText()
  if (!version) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  w.__insp = w.__insp || []
  w.__insp.push(['tagSession', { cta_text: version }])
  w.clarity = w.clarity || function () {
    // eslint-disable-next-line prefer-rest-params
    (w.clarity.q = w.clarity.q || []).push(arguments)
  }
  w.clarity('set', 'cta_text', version)
}
