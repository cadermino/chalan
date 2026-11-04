import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import client from '../api/client'
import Card from './Card'
import CopyButton from './CopyButton'
import { loadTypeLabel } from '../lib/loadTypes'

// Lo que no es mudanza (carga, cosas sueltas, un vehículo) es "tu pedido", y
// el resto del mensaje concuerda con él.
function what(order) {
  return !order.load_type || order.load_type === 'moving'
    ? { noun: 'tu mudanza', it: 'la' }
    : { noun: 'tu pedido', it: 'lo' }
}

const COMMENTS_ASK = {
  moving: 'Qué cosas vas a llevar',
  items: 'Qué cosas vas a enviar',
  cargo: 'Qué carga es',
  vehicle: 'Qué vehículo es',
}

// Cada código de `missing` (incomplete_orders en backoffice-api): cómo se le
// pide al cliente y cómo se lee en la fila.
function ask(code, order) {
  return {
    origin: 'La dirección exacta de recojo',
    destination: 'La dirección exacta de entrega',
    date: 'El día y la hora',
    comments: COMMENTS_ASK[order.load_type || 'moving'] || COMMENTS_ASK.moving,
    cargo_weight: 'Cuánto pesa, más o menos',
    contact: 'Tu nombre y correo',
  }[code]
}

const MISSING_LABELS = {
  origin: 'dirección de recojo',
  destination: 'dirección de entrega',
  date: 'fecha',
  comments: 'qué lleva',
  cargo_weight: 'peso',
  contact: 'nombre y correo',
}

export function completionMessage(order) {
  const name = (order.customer_name || '').trim().split(/\s+/)[0]
  const { noun, it } = what(order)
  const route = order.origin_district && order.destination_district
    ? ` de ${order.origin_district} a ${order.destination_district}`
    : ''
  return [
    `Hola${name ? ` ${name}` : ''}, vi que empezaste a cotizar ${noun}${route} en Chalán. Para mandar${it} a los transportistas solo me falta:`,
    '',
    ...order.missing.map((code) => `- ${ask(code, order)}`),
    '',
    `Respóndeme por aquí y ${it} completo yo.`,
  ].join('\n')
}

// El teléfono se guarda como lo escribieron: con o sin +51.
function whatsappUrl(order) {
  const digits = (order.phone || '').replace(/\D/g, '')
  const number = digits.length === 9 ? `51${digits}` : digits
  return `https://wa.me/${number}?text=${encodeURIComponent(completionMessage(order))}`
}

function daysAgo(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return days <= 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days} días`
}

function askedLabel(order) {
  if (!order.asked_at) return null
  return `Escrito ${daysAgo(order.asked_at)}${order.ask_count > 1 ? ` (${order.ask_count} veces)` : ''}`
}

// Órdenes que se quedaron a medias y dejaron su WhatsApp (el modal del paso 1,
// o el de su cuenta), con un botón que abre WhatsApp pidiéndole solo lo que
// falta. Abrirlo lo marca como escrito y lo baja al final de la lista.
export default function CompleteOrders() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['incomplete-orders'],
    queryFn: () => client.get('/api/orders/incomplete').then(({ data }) => data),
  })

  const markAsked = (order) => {
    client.post(`/api/orders/${order.id}/completion-asked`)
      .then(() => queryClient.invalidateQueries({ queryKey: ['incomplete-orders'] }))
      .catch(() => {})
  }

  return (
    <Card title="Completar órdenes" className="mb-4">
      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : isError ? (
        <p className="text-sm text-amber-700">
          No se pudo cargar.{' '}
          <button type="button" onClick={() => refetch()} className="font-medium underline">Reintentar</button>
        </p>
      ) : data.orders.length === 0 ? (
        <p className="text-sm text-gray-400">No hay órdenes a medias con WhatsApp.</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-gray-400">
            Órdenes de los últimos 30 días que no se mandaron a los transportistas y dejaron su WhatsApp. Una por
            número, la más reciente. WhatsApp se abre pidiéndole solo lo que falta; sin cliente, también su nombre y
            correo. Arriba las que nadie escribió.
          </p>
          <ul className="divide-y divide-gray-100">
            {data.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    <Link to={`/orders/${o.id}`} className="text-teal-700 hover:underline">#{o.id}</Link>
                    {' '}{o.customer_name || 'Sin cliente'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {[
                      `Creada ${daysAgo(o.created_date)}`,
                      loadTypeLabel(o.load_type),
                      [o.origin_district, o.destination_district].filter(Boolean).join(' → '),
                      `WhatsApp ${o.phone}`,
                      o.orders_with_phone > 1 && `${o.orders_with_phone} órdenes con este número`,
                    ].filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-xs text-amber-700">
                    Falta: {o.missing.map((code) => MISSING_LABELS[code]).join(', ')}
                  </p>
                  {o.asked_at && <p className="text-xs text-teal-700">{askedLabel(o)}</p>}
                </div>
                <div className="flex gap-2">
                  <CopyButton text={o.phone} label="Copiar número" />
                  <a
                    href={whatsappUrl(o)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => markAsked(o)}
                    className="shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700"
                  >
                    Abrir WhatsApp
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
