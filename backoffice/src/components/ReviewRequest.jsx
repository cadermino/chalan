import { CopyRow } from './CopyButton'
import CopyButton from './CopyButton'
import { WHATSAPP_WINDOW, waUrl } from './OrderCarriers'

// "Link de reseña" del detalle de una orden y de un servicio, con dos mensajes
// listos para pedirle la reseña al cliente desde el WhatsApp de Chalán: uno que
// pregunta cómo le fue y otro personal, de Carlos. Sin WhatsApp del cliente,
// los botones copian el mensaje.

// Lo que se hizo, como se le dice al cliente: no todo es una mudanza.
const ORDER_WHAT = {
  moving: 'tu mudanza',
  items: 'tu flete',
  cargo: 'el transporte de tu carga',
  vehicle: 'el traslado de tu vehículo',
}

export function orderWhat(loadType) {
  return ORDER_WHAT[loadType || 'moving'] || ORDER_WHAT.moving
}

export function serviceWhat(serviceName) {
  return serviceName ? `tu servicio de ${serviceName.toLowerCase()}` : 'tu servicio'
}

// "carla rojas" → "Carla": muchos escriben su nombre en minúsculas.
function firstName(name) {
  const first = (name || '').trim().split(/\s+/)[0]
  return first ? first[0].toUpperCase() + first.slice(1).toLowerCase() : ''
}

// `transport`: lo que se llevó "llega"; un servicio "queda".
export function reviewMessages({ customerName, carrierName, what, url, transport }) {
  const name = firstName(customerName)
  const hello = `Hola${name ? ` ${name}` : ''}`
  const howWas = [
    `${hello}, ¿qué tal te fue con ${what}? Esperamos que todo haya ${transport ? 'llegado' : 'quedado'} bien. `
      + `Si tienes un minuto, cuéntanos cómo te ${carrierName ? `atendió ${carrierName}` : 'atendieron'} aquí:`,
    url,
    'Tu opinión nos ayuda a mejorar y a que otros clientes elijan mejor. ¡Gracias!',
  ].join('\n')
  const personal = [
    `${hello}, soy Carlos de Chalán. Gracias por confiar en nosotros para ${what}. `
      // "le": sirve para una empresa y para un contacto que es una persona ("Jorge").
      + `${carrierName || 'Quien te atendió'} trabaja por sus reseñas, así que si te gustó el trabajo, `
      + 'una calificación tuya le ayuda muchísimo:',
    url,
    'Y si algo no salió bien, también cuéntanos, que queremos saberlo.',
  ].join('\n')
  return { howWas, personal }
}

function MessageButton({ phone, text, label }) {
  if (!phone) return <CopyButton text={text} label={`Copiar: ${label}`} />
  return (
    <a
      href={waUrl(phone, text)}
      target={WHATSAPP_WINDOW}
      rel="noopener noreferrer"
      className="inline-flex items-center rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
    >
      WhatsApp: {label}
    </a>
  )
}

export default function ReviewRequest({ url, hint, phone, customerName, carrierName, what, transport }) {
  const { howWas, personal } = reviewMessages({ customerName, carrierName, what, url, transport })
  return (
    <div>
      <CopyRow title="Link de reseña" hint={hint} text={url} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <MessageButton phone={phone} text={howWas} label="¿cómo te fue?" />
        <MessageButton phone={phone} text={personal} label="de Carlos" />
      </div>
    </div>
  )
}
