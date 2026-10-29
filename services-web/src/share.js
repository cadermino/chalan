// Lo que se ve al compartir el link de cada formulario (WhatsApp, Facebook):
// título y descripción. WhatsApp no ejecuta JavaScript, así que el build escribe
// un HTML por servicio con esto (sharePages en vite.config.js) y nginx entrega
// el de cada ruta. La app usa el mismo título para la pestaña (config.js).
// Sin `window`: lo importa también vite.config.js, que corre en Node.

export const SHARE_IMAGE = 'https://chalan-public.s3.amazonaws.com/home/truck-list-fb.png'

export const SHARE = {
  packing: {
    slug: 'embalaje',
    title: 'Cotiza tu embalaje | Chalán',
    description: 'Cuéntanos qué hay que embalar y te llegan cotizaciones de transportistas, con los materiales incluidos. Lima, Callao y Huancayo.',
  },
  furniture_assembly: {
    slug: 'armado',
    title: 'Cotiza el armado de tus muebles | Chalán',
    description: 'Cuéntanos qué muebles hay que armar o desarmar y te llegan cotizaciones de armadores.',
  },
  painting: {
    slug: 'pintura',
    title: 'Cotiza la pintura de tu casa | Chalán',
    description: 'Cuéntanos qué hay que pintar o súbenos un video, y te llegan cotizaciones de pintores. Lima, Callao y Huancayo.',
  },
  masonry: {
    slug: 'porcelanato',
    title: 'Cotiza la instalación de porcelanato | Chalán',
    description: 'Cuéntanos qué hay que instalar o súbenos un video, y te llegan cotizaciones de instaladores de porcelanato y cerámica. Lima, Callao y Huancayo.',
  },
  microcement: {
    slug: 'microcemento',
    title: 'Cotiza la aplicación de microcemento | Chalán',
    description: 'Cuéntanos dónde va el microcemento o súbenos un video, y te llegan cotizaciones de aplicadores. Lima, Callao y Huancayo.',
  },
}
