// Servicios a domicilio que todavía se cotizan solo por WhatsApp (sin formulario
// en services-web). Lo usan sus landings y el llamado al final de sus posts del
// blog, así el texto del WhatsApp y la ruta viven en un solo lugar.

export const WHATSAPP_NUMBER = '51972643007'

export const whatsappUrl = (text: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`

export type HomeServiceKey = 'pintura' | 'microcemento' | 'porcelanato'

export const HOME_SERVICES: Record<
  HomeServiceKey,
  { path: string; name: string; whatsappText: string; blogCta: { eyebrow: string; title: string; body: string } }
> = {
  pintura: {
    path: '/pintores-a-domicilio',
    name: 'Pintores a domicilio',
    whatsappText: 'Hola, quiero cotizar un servicio de pintura',
    blogCta: {
      eyebrow: '¿Prefieres que lo pinten por ti?',
      title: 'Cotiza la pintura por WhatsApp',
      body: 'Mándanos fotos de las paredes y los metros (o las medidas de cada ambiente) y te respondemos con el precio. Lima, Callao y Huancayo.',
    },
  },
  microcemento: {
    path: '/microcemento',
    name: 'Aplicación de microcemento',
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
    whatsappText: 'Hola, quiero cotizar la instalación de porcelanato o cerámica',
    blogCta: {
      eyebrow: '¿Necesitas quien lo instale?',
      title: 'Cotiza la instalación por WhatsApp',
      body: 'Mándanos fotos del ambiente, los metros y el formato de las piezas. Te respondemos con el precio.',
    },
  },
}

// Landings de servicios que no son mudanza. El agente de cotización del chat
// (ChatWidget) cotiza mudanzas y fletes, así que ahí no se muestra; tampoco en
// los posts que cierran con el WhatsApp de estos servicios (ver layout.tsx).
// Embalaje sí lo lleva: el agente atiende sus consultas.
export const NON_MOVING_PATHS = ['/armado-de-muebles', ...Object.values(HOME_SERVICES).map((s) => s.path)]
