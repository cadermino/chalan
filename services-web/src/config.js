// Mismo número que usan las landings (/embalaje-profesional, /armado-de-muebles).
export const WHATSAPP_NUMBER = '51972643007'

export function whatsappUrl(text) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

// Un formulario por servicio, en su propia ruta. La app no navega de uno a otro:
// el servicio sale de la URL con que se abrió, y todo lo demás de acá.
const FLOWS = {
  packing: {
    basePath: '/embalaje/cotizar',
    itemsSlug: 'que-embalamos',
    title: 'Cotiza tu embalaje | Chalán',
    header: 'Embalaje profesional',
    steps: ['Dirección', 'Qué embalamos', 'Fecha y contacto'],
    addressTitle: '¿Dónde hay que embalar?',
    addressLead: 'Vamos a tu domicilio con todo el material.',
    itemsSummary: 'Qué embalamos',
    emptyItems: 'Agrega al menos una cosa para embalar.',
    dateHint: 'Para una casa completa te recomendamos pedirlo con 2–3 días de anticipación.',
    whatsappAsk: 'Hola, quiero cotizar un servicio de embalaje',
    whatsappSent: 'Hola, acabo de enviar una solicitud de embalaje',
    quotesFrom: 'los transportistas',
    payDay: 'el día del servicio',
  },
  furniture_assembly: {
    basePath: '/armado/cotizar',
    itemsSlug: 'muebles',
    title: 'Cotiza el armado de tus muebles | Chalán',
    header: 'Armado de muebles',
    steps: ['Dirección', 'Muebles', 'Fecha y contacto'],
    addressTitle: '¿Dónde están los muebles?',
    addressLead: 'Si es una mudanza, pon dónde se desarman. El destino lo pedimos después.',
    itemsSummary: 'Muebles',
    emptyItems: 'Agrega al menos un mueble.',
    dateHint: 'Para varios muebles te recomendamos pedirlo con 2–3 días de anticipación.',
    whatsappAsk: 'Hola, quiero cotizar el armado o desarmado de muebles',
    whatsappSent: 'Hola, acabo de enviar una solicitud de armado de muebles',
    quotesFrom: 'los armadores',
    payDay: 'el día del servicio',
  },
  painting: {
    basePath: '/pintura/cotizar',
    itemsSlug: 'que-pintamos',
    title: 'Cotiza la pintura de tu casa | Chalán',
    header: 'Pintura a domicilio',
    steps: ['Dirección', 'Qué pintamos', 'Fecha y contacto'],
    addressTitle: '¿Dónde hay que pintar?',
    addressLead: 'La dirección del depa o la casa.',
    itemsSummary: 'Qué pintamos',
    emptyItems: 'Cuéntanos qué hay que pintar, o sube un video explicándolo.',
    dateHint: 'Para un depa completo te recomendamos pedirlo con unos días de anticipación.',
    whatsappAsk: 'Hola, quiero cotizar un servicio de pintura',
    whatsappSent: 'Hola, acabo de enviar una solicitud de pintura',
    quotesFrom: 'los pintores',
    // Pintar dura varios días: se paga al final, no "el día del servicio".
    payDay: 'al terminar el trabajo',
  },
}

const [SERVICE_CODE, FLOW] = Object.entries(FLOWS).find(
  ([, flow]) => window.location.pathname.startsWith(flow.basePath),
) || ['packing', FLOWS.packing]

export const SERVICE = SERVICE_CODE
export const COPY = FLOW
export const BASE_PATH = FLOW.basePath
export const PATHS = {
  address: `${BASE_PATH}/direccion`,
  items: `${BASE_PATH}/${FLOW.itemsSlug}`,
  contact: `${BASE_PATH}/fecha-y-contacto`,
  sent: `${BASE_PATH}/enviado`,
  // + /<public_id>: el link que le llega al cliente por WhatsApp.
  quotations: `${BASE_PATH}/cotizaciones`,
}
export const PLACES_API_KEY = import.meta.env.VITE_PLACES_API_KEY

// Qué hacer con cada mueble; los codes los valida el API principal.
export const FURNITURE_WORKS = [
  { code: 'assemble', label: 'Armar', hint: 'Nuevo o ya trasladado' },
  { code: 'disassemble', label: 'Desarmar', hint: 'Para sacarlo o guardarlo' },
  { code: 'both', label: 'Desarmar y armar', hint: 'Se desarma acá y se arma en otra dirección' },
]
export const workLabel = (code) => FURNITURE_WORKS.find((w) => w.code === code)?.label || code

// Las preguntas rápidas de pintura, todas opcionales; los codes los valida el API
// principal (PAINTING_* en app/api/service_request/types.py).
export const PAINTING_AREAS = [
  { code: 'interior', label: 'Interior' },
  { code: 'exterior', label: 'Exterior o fachada' },
  { code: 'both', label: 'Ambos' },
]
export const PAINTING_SIZES = [
  { code: 'detail', label: 'Una pared o un detalle' },
  { code: 'one_room', label: '1 ambiente' },
  { code: 'few_rooms', label: '2 a 3 ambientes' },
  { code: 'whole', label: 'Depa o casa completa' },
]
export const PAINTING_PAINT_BY = [
  { code: 'customer', label: 'La compro yo' },
  { code: 'painter', label: 'Que la incluya el pintor' },
  { code: 'unsure', label: 'No sé, que me recomienden' },
]
export const PAINTING_WALL_ISSUES = [
  { code: 'humidity', label: 'Humedad' },
  { code: 'cracks', label: 'Rajaduras' },
  { code: 'putty', label: 'Necesitan empaste' },
]
const labelOf = (list, code) => list.find((o) => o.code === code)?.label

// Las respuestas en una línea, para los resúmenes: "Interior · 2 a 3 ambientes · 45 m²".
export function paintingFacts(details = {}) {
  const issues = (details.wall_issues || []).map((c) => labelOf(PAINTING_WALL_ISSUES, c)?.toLowerCase())
  return [
    labelOf(PAINTING_AREAS, details.area),
    labelOf(PAINTING_SIZES, details.size),
    details.area_m2 ? `${details.area_m2} m²` : null,
    details.paint_by ? `Pintura: ${labelOf(PAINTING_PAINT_BY, details.paint_by)?.toLowerCase()}` : null,
    issues.length ? `Paredes: ${issues.join(', ')}` : null,
  ].filter(Boolean).join(' · ')
}
