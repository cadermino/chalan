import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import client from '../api/client'
import Card from './Card'
import CopyButton from './CopyButton'
import { shortDate } from '../lib/shortDate'

// "S/ 280" o "S/ 231.50": como lo ve el cliente en su página.
function money(amount) {
  const decimals = Number.isInteger(amount) ? 0 : 2
  return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: decimals, maximumFractionDigits: 2 })}`
}

// Lo que no es mudanza (carga, cosas sueltas, un vehículo) es "tu pedido".
function what(order) {
  return !order.load_type || order.load_type === 'moving' ? 'tu mudanza' : 'tu pedido'
}

// El link de acceso sin contraseña (lo canjea el Vue en /acceso). `r` le dice a
// GA4 que entró por este recordatorio (views/OrderAccess.vue).
function accessUrl(order) {
  return `${window.location.origin}/acceso/${order.token}?r=whatsapp`
}

export function reminderMessage(order) {
  const name = (order.customer_name || '').trim().split(/\s+/)[0]
  const count = order.quotations_count === 1
    ? `1 cotización, de ${money(order.lowest_total)}`
    : `${order.quotations_count} cotizaciones, desde ${money(order.lowest_total)}`
  const date = order.appointment_date ? shortDate(order.appointment_date) : null
  const lines = order.past
    ? [
      `Hola${name ? ` ${name}` : ''}, ${what(order)}${date ? ` era para el ${date}` : ''} y tiene ${count}.`,
      '¿Todavía la necesitas? Respóndeme con la nueva fecha y la reagendamos. Las cotizaciones están aquí:',
      accessUrl(order),
      '',
      '¿Te parece caro? Respóndeme y te consigo una rebaja.',
    ]
    : [
      `Hola${name ? ` ${name}` : ''}, ${what(order)}${date ? ` del ${date}` : ''} tiene ${count}. Míralas y elige aquí:`,
      accessUrl(order),
      '',
      '¿Te parece caro? Respóndeme y te consigo una rebaja.',
    ]
  return lines.join('\n')
}

// El teléfono se guarda como lo escribieron: con o sin +51.
function whatsappUrl(order) {
  const digits = (order.phone || '').replace(/\D/g, '')
  const number = digits.length === 9 ? `51${digits}` : digits
  return `https://wa.me/${number}?text=${encodeURIComponent(reminderMessage(order))}`
}

function remindedLabel(order) {
  if (!order.reminded_at) return null
  const days = Math.floor((Date.now() - new Date(order.reminded_at).getTime()) / 86400000)
  const when = days <= 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days} días`
  return `Recordado ${when}${order.reminder_count > 1 ? ` (${order.reminder_count} veces)` : ''}`
}

// Clientes con cotizaciones que no eligieron, con un botón que abre WhatsApp
// (el de Chalán, donde esté abierto) con el mensaje ya escrito: el precio más
// bajo y el link para elegir sin contraseña. Abrirlo (o copiar el mensaje) lo
// marca como recordado y lo baja al final de la lista.
export default function CustomerReminders() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customer-reminders'],
    queryFn: () => client.get('/api/orders/customer-reminders').then(({ data }) => data),
  })

  const markReminded = (order) => {
    client.post(`/api/orders/${order.id}/customer-reminded`)
      .then(() => queryClient.invalidateQueries({ queryKey: ['customer-reminders'] }))
      .catch(() => {})
  }

  return (
    <Card title="Recordar a clientes" className="mb-4">
      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : isError ? (
        <p className="text-sm text-amber-700">
          No se pudo cargar.{' '}
          <button type="button" onClick={() => refetch()} className="font-medium underline">Reintentar</button>
        </p>
      ) : data.orders.length === 0 ? (
        <p className="text-sm text-gray-400">No hay clientes con cotizaciones por elegir.</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-gray-400">
            Órdenes pendientes con cotizaciones y ninguna elegida, también las de fecha pasada. WhatsApp se abre con
            el mensaje escrito: el precio más bajo que ve el cliente y su link para elegir sin contraseña. Arriba las
            que nadie recordó.
          </p>
          <ul className="divide-y divide-gray-100">
            {data.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    <Link to={`/orders/${o.id}`} className="text-teal-700 hover:underline">#{o.id}</Link>
                    {' '}{o.customer_name || 'Sin nombre'}
                    {o.past && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-800">
                        Fecha pasada
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {[
                      o.appointment_date && shortDate(o.appointment_date),
                      [o.origin_district, o.destination_district].filter(Boolean).join(' → '),
                      `${o.quotations_count === 1 ? '1 cotización' : `${o.quotations_count} cotizaciones`} desde ${money(o.lowest_total)}`,
                      o.phone ? `WhatsApp ${o.phone}` : 'Sin WhatsApp',
                    ].filter(Boolean).join(' · ')}
                  </p>
                  {o.reminded_at && <p className="text-xs text-teal-700">{remindedLabel(o)}</p>}
                </div>
                <div className="flex gap-2">
                  {o.phone ? (
                    <>
                      <CopyButton text={o.phone} label="Copiar número" />
                      <a
                        href={whatsappUrl(o)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => markReminded(o)}
                        className="shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700"
                      >
                        Abrir WhatsApp
                      </a>
                    </>
                  ) : (
                    <CopyButton text={reminderMessage(o)} label="Copiar mensaje" onCopy={() => markReminded(o)} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
