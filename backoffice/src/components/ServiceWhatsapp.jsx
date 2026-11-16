import { useState } from 'react'
import toast from 'react-hot-toast'
import client from '../api/client'
import CopyButton from './CopyButton'
import { firstName } from './CarrierReminders'
import { WHATSAPP_WINDOW, ago, waUrl } from './OrderCarriers'
import { formatDay, formatMoney, formatTimestamp } from './ServiceRequestView'
import { districtOf } from '../lib/district'

// Lo mismo que en el detalle de una orden (OrderCarriers, CustomerReminders),
// para una solicitud de servicio: se le escribe desde el WhatsApp de Chalán.

// El link corto (chalan.pe/s/…, lo canjea Next por el link de siempre), con el
// origen actual: sirve igual en local y en producción. No vence, como el de las órdenes.
export function carrierUrl(link) {
  return `${window.location.origin}/s/${link.code}`
}

function serviceName(request) {
  return (request.service_type?.name || 'un servicio').toLowerCase()
}

export function carrierNoticeMessage(link, request) {
  const name = firstName(link)
  const district = districtOf(request)
  const when = request.preferred_date ? formatDay(request.preferred_date) : null
  return [
    `Hola${name ? ` ${name}` : ''}, tienes una solicitud nueva de ${serviceName(request)} para cotizar en Chalán:`,
    '',
    `• ${[when, district].filter(Boolean).join(' · ')}`,
    `  ${carrierUrl(link)}`,
    '',
    'Si no puedes, ábrela y marca que no puedes, así no te la volvemos a mandar.',
  ].join('\n')
}

function linkStatus(link, notifiedAt) {
  if (link.quotation_amount != null) return `Cotizó ${formatMoney(link.quotation_amount)}`
  if (link.declined) return 'No puede'
  return [
    link.notified ? `Avisado ${formatTimestamp(notifiedAt)}` : 'Sin avisar',
    link.whatsapp_at && `WhatsApp ${ago(link.whatsapp_at)}`,
  ].filter(Boolean).join(' · ')
}

// Las empresas que hacen el servicio, con su link. Mientras la solicitud busca
// precios, "Avisar a <empresa>" abre el chat de la siguiente que falta (no
// cotizó, no dijo que no puede y no tiene el WhatsApp) con el mensaje escrito.
export function ServiceCarrierList({ request }) {
  // Lo marcado en esta visita, para que aparezca la siguiente sin recargar.
  const [sentNow, setSentNow] = useState({})
  const notifiedAt = Object.fromEntries(request.notifications.map((n) => [n.carrier_company_id, n.sent_at]))
  const links = request.links.map((l) => (sentNow[l.id] ? { ...l, to_notify: false, whatsapp_at: sentNow[l.id] } : l))
  const due = links.filter((l) => l.to_notify && l.phone)
  const withoutPhone = links.filter((l) => l.to_notify && !l.phone).length

  const markSent = (link) => {
    setSentNow((old) => ({ ...old, [link.id]: new Date().toISOString() }))
    client.post(`/api/service-requests/${request.id}/carrier-whatsapp`, { carrier_company_id: link.id })
      .catch(() => {
        setSentNow(({ [link.id]: _, ...rest }) => rest)
        toast.error(`No se pudo marcar a ${link.name} como avisado.`)
      })
  }

  return (
    <>
      {request.looking && (
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
                href={waUrl(due[0].phone, carrierNoticeMessage(due[0], request))}
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
        {links.map((link) => {
          const canWrite = request.looking && link.quotation_amount == null && !link.declined
          return (
            <li key={link.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {link.name}
                  {link.coordinator_name && (
                    <span className="ml-2 text-xs font-normal text-gray-500">Contacto en WhatsApp → {link.coordinator_name}</span>
                  )}
                </p>
                <p className={`text-xs ${link.to_notify ? 'text-amber-700' : 'text-gray-400'}`}>
                  {linkStatus(link, notifiedAt[link.id])}
                  {canWrite && !link.phone && ' · Sin WhatsApp'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {canWrite && (link.phone ? (
                  <a
                    href={waUrl(link.phone, carrierNoticeMessage(link, request))}
                    target={WHATSAPP_WINDOW}
                    rel="noreferrer"
                    onClick={() => markSent(link)}
                    className="rounded-lg border border-green-600 px-3 py-1.5 text-xs text-green-700 hover:bg-green-50"
                  >
                    WhatsApp
                  </a>
                ) : (
                  <CopyButton text={carrierNoticeMessage(link, request)} label="Copiar mensaje" onCopy={() => markSent(link)} />
                ))}
                <CopyButton text={carrierUrl(link)} />
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

export function customerReminderMessage(request) {
  const quotations = request.quotations || []
  const lowest = Math.min(...quotations.map((q) => q.total_amount))
  const name = (request.customer_name || '').trim().split(/\s+/)[0]
  const district = districtOf(request)
  const count = quotations.length === 1
    ? `1 cotización, de ${formatMoney(lowest)}`
    : `${quotations.length} cotizaciones, desde ${formatMoney(lowest)}`
  const when = request.preferred_date ? ` del ${formatDay(request.preferred_date)}` : ''
  return [
    `Hola${name ? ` ${name}` : ''}, tu pedido de ${serviceName(request)}${when}${district ? ` en ${district}` : ''} tiene ${count}. Míralas y elige aquí:`,
    `${window.location.origin}${request.customer_quotations_path}`,
    '',
    '¿Te parece caro? Respóndeme y te consigo una rebaja.',
  ].join('\n')
}

// En la tarjeta "Cliente": el aviso de sus cotizaciones con su página para
// elegir, mientras no eligió. "Nueva cotización" si llegó una después del último.
export function ServiceCustomerReminder({ request, onReminded, className = '' }) {
  const quotations = request.quotations || []
  if (!request.looking || !request.customer_quotations_path || quotations.length === 0) return null

  const markReminded = () => {
    client.post(`/api/service-requests/${request.id}/customer-reminded`, { quotation_id: request.last_quotation_id })
      .then(onReminded)
      .catch(() => {})
  }
  const message = customerReminderMessage(request)
  const reminded = request.customer_reminded_at
    && `Avisado ${ago(request.customer_reminded_at)}${request.customer_reminder_count > 1 ? ` (${request.customer_reminder_count} veces)` : ''}.`

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">
          Avisarle por WhatsApp
          {request.new_quotation && (
            <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs font-normal text-green-800">
              Nueva cotización
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-gray-400">
          Sus cotizaciones con el precio más bajo y su página para elegir.
          {reminded && <span className="text-teal-700"> {reminded}</span>}
        </p>
      </div>
      {request.whatsapp ? (
        <a
          href={waUrl(request.whatsapp, message)}
          target="_blank"
          rel="noreferrer"
          onClick={markReminded}
          className="shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700"
        >
          Abrir WhatsApp
        </a>
      ) : (
        <CopyButton text={message} label="Copiar mensaje" onCopy={markReminded} />
      )}
    </div>
  )
}
