// Lo que se ve al compartir el link de cada formulario (WhatsApp, Facebook):
// título y descripción. WhatsApp no ejecuta JavaScript, así que el build escribe
// un HTML por servicio con esto (sharePages en vite.config.js) y nginx entrega
// el de cada ruta. La app usa el mismo título para la pestaña (config.js).
// Sin `window`: lo importa también vite.config.js, que corre en Node.

// La misma para la página de cotizaciones de todos los servicios.
export const QUOTES_DESCRIPTION = 'Mira los precios que te mandaron y elige el que más te convenga.'

// El chalán (frontend-react/public/og/chalan.png, lo sirve Next), no el camión de
// las mudanzas: son servicios para la casa.
export const SHARE_IMAGE = 'https://chalan.pe/og/chalan.png'

export const SHARE = {
  packing: {
    slug: 'embalaje',
    // La página de cotizaciones del cliente (<form>/cotizaciones/<id>), que va por WhatsApp.
    quotesTitle: 'Tus cotizaciones de embalaje | Chalán',
    title: 'Cotiza tu embalaje | Chalán',
    description: 'Cuéntanos qué hay que embalar y te llegan cotizaciones de transportistas, con los materiales incluidos. Lima, Callao y Huancayo.',
  },
  furniture_assembly: {
    slug: 'armado',
    quotesTitle: 'Tus cotizaciones de armado de muebles | Chalán',
    title: 'Cotiza el armado de tus muebles | Chalán',
    description: 'Cuéntanos qué muebles hay que armar o desarmar y te llegan cotizaciones de armadores.',
  },
  painting: {
    slug: 'pintura',
    quotesTitle: 'Tus cotizaciones de pintura | Chalán',
    title: 'Cotiza la pintura de tu casa | Chalán',
    description: 'Cuéntanos qué hay que pintar o súbenos un video, y te llegan cotizaciones de pintores. Lima, Callao y Huancayo.',
  },
  masonry: {
    slug: 'porcelanato',
    quotesTitle: 'Tus cotizaciones de instalación de porcelanato | Chalán',
    title: 'Cotiza la instalación de porcelanato | Chalán',
    description: 'Cuéntanos qué hay que instalar o súbenos un video, y te llegan cotizaciones de instaladores de porcelanato y cerámica. Lima, Callao y Huancayo.',
  },
  microcement: {
    slug: 'microcemento',
    quotesTitle: 'Tus cotizaciones de microcemento | Chalán',
    title: 'Cotiza la aplicación de microcemento | Chalán',
    description: 'Cuéntanos dónde va el microcemento o súbenos un video, y te llegan cotizaciones de aplicadores. Lima, Callao y Huancayo.',
  },
}
