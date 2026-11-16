import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import client from '../api/client'
import Card from './Card'
import CopyButton from './CopyButton'
import { firstName, orderLine } from './CarrierReminders'

// Todos los chats se abren en la misma pestaña: avisar a quince no deja quince pestañas.
export const WHATSAPP_WINDOW = 'chalan-whatsapp'

// El teléfono de las empresas se guarda como lo escribieron: con o sin +51.
export function waUrl(phone, text) {
  const digits = (phone || '').replace(/\D/g, '')
  const number = digits.length === 9 ? `51${digits}` : digits
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

// Con el link corto para cotizar (chalan.pe/c/…), como el recordatorio. Si la
// orden cambió después de que cotizó, su link le muestra qué cambió.
export function noticeMessage(company, order) {
  const name = firstName(company)
  const line = orderLine({ ...order, code: company.code })
  const lines = company.requote
    ? [
      `Hola${name ? ` ${name}` : ''}, una orden que cotizaste en Chalán cambió:`,
      '',
      line,
      '',
      'Ábrela para ver qué cambió y vuelve a cotizar.',
    ]
    : [
      `Hola${name ? ` ${name}` : ''}, tienes una orden nueva para cotizar en Chalán:`,
      '',
      line,
      '',
      'Si no puedes, ábrela y marca que no puedes, así no te la volvemos a mandar.',
    ]
  return lines.join('\n')
}

function whatsappUrl(company, order) {
  return waUrl(company.phone, noticeMessage(company, order))
}

export function ago(iso) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 60) return minutes <= 1 ? 'hace un momento' : `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'ayer' : `hace ${days} días`
}

function status(c) {
  if (c.quotation_amount != null) return `Cotizó S/ ${c.quotation_amount}`
  if (c.declined) return 'No puede'
  if (c.unavailable) return 'No disponible ese día'
  if (c.whatsapp_at) return `WhatsApp ${ago(c.whatsapp_at)}${c.to_notify ? ', antes de que la orden cambiara' : ''}`
  if (c.requote) return 'Cotizó antes de que la orden cambiara'
  return 'Link para que cotice'
}

// Las empresas que hacen mudanzas, con su link para cotizar. Mientras la orden
// busca cotizaciones, "Avisar por WhatsApp" abre el chat de la siguiente que
// falta con el mensaje escrito (desde el WhatsApp de Chalán, sin Twilio): se
// aprieta Enviar, se vuelve y aparece la siguiente. Se saltan las que
// cotizaron, no pueden, no están disponibles ese día o ya tienen el aviso.
export default function OrderCarriers({ orderId }) {
  const queryClient = useQueryClient()
  const queryKey = ['quotation-links', orderId]
  const { data } = useQuery({
    queryKey,
    queryFn: () => client.get(`/api/orders/${orderId}/quotation-links`).then(({ data }) => data),
  })
  if (!data || data.companies.length === 0) return null

  const { companies, looking, order } = data
  const due = companies.filter((c) => c.to_notify && c.phone)
  const withoutPhone = companies.filter((c) => c.to_notify && !c.phone).length

  const markSent = (company) => {
    const update = (changes) => queryClient.setQueryData(queryKey, (old) => old && {
      ...old,
      companies: old.companies.map((c) => (c.id === company.id ? { ...c, ...changes } : c)),
    })
    update({ to_notify: false, whatsapp_at: new Date().toISOString() })
    client.post(`/api/orders/${orderId}/carrier-whatsapp`, { carrier_company_id: company.id })
      .catch(() => {
        update({ to_notify: company.to_notify, whatsapp_at: company.whatsapp_at })
        toast.error(`No se pudo marcar a ${company.name} como avisado.`)
      })
  }

  return (
    <Card title="Transportistas">
      {looking && (
        <div className="mb-3 rounded-lg bg-green-50 p-3">
          {due.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-700">
                {due.length === 1 ? 'Falta 1' : `Faltan ${due.length}`} por avisar por WhatsApp.
                <span className="block text-xs text-gray-500">
                  Se abre tu WhatsApp con el mensaje y su link: envíalo, vuelve y sigue con el siguiente.
                  {withoutPhone > 0 && ` ${withoutPhone === 1 ? 'Otro no tiene' : `Otros ${withoutPhone} no tienen`} WhatsApp anotado.`}
                </span>
              </p>
              <a
                href={whatsappUrl(due[0], order)}
                target={WHATSAPP_WINDOW}
                rel="noreferrer"
                onClick={() => markSent(due[0])}
                className="shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
              >
                Avisar a {due[0].name}
              </a>
            </div>
          ) : (
            <p className="text-sm text-gray-700">
              {withoutPhone === 0
                ? 'Ya avisaste a todos los que faltaban por WhatsApp.'
                : `${withoutPhone === 1 ? 'Falta 1' : `Faltan ${withoutPhone}`} sin WhatsApp anotado: copia su mensaje.`}
            </p>
          )}
        </div>
      )}
      <ul className="divide-y divide-gray-100">
        {companies.map((c) => {
          // Al que ya cotizó o no puede no se le escribe desde aquí.
          const canWrite = looking && c.quotation_amount == null && !c.declined
          return (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {c.name}
                  {c.coordinator_name && (
                    <span className="ml-2 text-xs font-normal text-gray-500">Contacto en WhatsApp → {c.coordinator_name}</span>
                  )}
                  {c.departments?.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-gray-400">{c.departments.join(' · ')}</span>
                  )}
                </p>
                <p className={`text-xs ${c.to_notify ? 'text-amber-700' : 'text-gray-400'}`}>
                  {looking ? status(c) : 'Link para que cotice'}
                  {canWrite && !c.phone && ' · Sin WhatsApp'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {canWrite && (c.phone ? (
                  <a
                    href={whatsappUrl(c, order)}
                    target={WHATSAPP_WINDOW}
                    rel="noreferrer"
                    onClick={() => markSent(c)}
                    className="rounded-lg border border-green-600 px-3 py-1.5 text-xs text-green-700 hover:bg-green-50"
                  >
                    WhatsApp
                  </a>
                ) : (
                  <CopyButton text={noticeMessage(c, order)} label="Copiar mensaje" onCopy={() => markSent(c)} />
                ))}
                <CopyButton text={`${window.location.origin}/c/${c.code}`} />
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
