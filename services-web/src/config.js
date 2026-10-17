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
}
export const PLACES_API_KEY = import.meta.env.VITE_PLACES_API_KEY

// Qué hacer con cada mueble; los codes los valida el API principal.
export const FURNITURE_WORKS = [
  { code: 'assemble', label: 'Armar', hint: 'Nuevo o ya trasladado' },
  { code: 'disassemble', label: 'Desarmar', hint: 'Para sacarlo o guardarlo' },
  { code: 'both', label: 'Desarmar y armar', hint: 'Se desarma acá y se arma en otra dirección' },
]
export const workLabel = (code) => FURNITURE_WORKS.find((w) => w.code === code)?.label || code
