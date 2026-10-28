// Servicios a domicilio de las landings con ServiceLanding. Lo usan sus landings
// y el llamado al final de sus posts del blog, así el texto del WhatsApp y la
// ruta viven en un solo lugar. Los que tienen formulario en services-web llevan
// `formUrl` (pintura, porcelanato): ahí el botón principal es el formulario y WhatsApp queda
// de segunda opción. Los demás se cotizan solo por WhatsApp.

export const WHATSAPP_NUMBER = '51972643007'

export const whatsappUrl = (text: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`

export type HomeServiceKey = 'pintura' | 'microcemento' | 'porcelanato' | 'departamentos'

export const HOME_SERVICES: Record<
  HomeServiceKey,
  {
    path: string
    name: string
    // Código de lu_service_types: el `service` de los eventos de GA4.
    code: string
    whatsappText: string
    formUrl?: string
    blogCta: { eyebrow: string; title: string; body: string }
  }
> = {
  pintura: {
    path: '/pintores-a-domicilio',
    name: 'Pintores a domicilio',
    code: 'painting',
    whatsappText: 'Hola, quiero cotizar un servicio de pintura',
    formUrl: '/pintura/cotizar',
    blogCta: {
      eyebrow: '¿Prefieres que lo pinten por ti?',
      title: 'Cotiza la pintura en 2 minutos',
      body: 'Cuéntanos qué hay que pintar o súbenos un video recorriendo las paredes. Los pintores te cotizan y eliges. Lima, Callao y Huancayo.',
    },
  },
  microcemento: {
    path: '/microcemento',
    name: 'Aplicación de microcemento',
    code: 'microcement',
    whatsappText: 'Hola, quiero cotizar la aplicación de microcemento',
    blogCta: {
      eyebrow: '¿Quieres microcemento en tu casa?',
      title: 'Cotiza la aplicación por WhatsApp',
      body: 'Mándanos fotos de la superficie (piso, pared o baño), qué material tiene hoy y los metros. Te respondemos con el precio.',
    },
  },
  porcelanato: {
    path: '/instalacion-de-porcelanato',
    name: 'Instalación de porcelanato y cerámica',
    code: 'masonry',
    whatsappText: 'Hola, quiero cotizar la instalación de porcelanato o cerámica',
    formUrl: '/porcelanato/cotizar',
    blogCta: {
      eyebrow: '¿Necesitas quien lo instale?',
      title: 'Cotiza la instalación en 2 minutos',
      body: 'Cuéntanos qué hay que instalar o súbenos un video del ambiente. Los instaladores te cotizan y eliges. Lima, Callao y Huancayo.',
    },
  },
  // Se cotiza con visita técnica (sin costo), no con precio por m².
  departamentos: {
    path: '/reparacion-de-departamentos',
    name: 'Reparación de departamentos en alquiler',
    code: 'apartment_repair',
    whatsappText: 'Hola, quiero agendar una visita técnica para mi departamento',
    blogCta: {
      eyebrow: '¿Tu departamento necesita arreglos?',
      title: 'Agenda una visita técnica sin costo',
      body: 'Cuéntanos el distrito y mándanos unas fotos. Vamos a verlo y te damos una cotización exacta.',
    },
  },
}

// Landings de servicios que no son mudanza. El agente de cotización del chat
// (ChatWidget) cotiza mudanzas y fletes, así que ahí no se muestra (ver layout.tsx).
export const NON_MOVING_PATHS = [
  '/embalaje-profesional',
  '/armado-de-muebles',
  ...Object.values(HOME_SERVICES).map((s) => s.path),
]
