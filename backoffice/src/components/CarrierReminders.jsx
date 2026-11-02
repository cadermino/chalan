import { useQuery } from '@tanstack/react-query'
import client from '../api/client'
import Card from './Card'
import CopyButton from './CopyButton'
import { cargoWeightLabel, loadTypeLabel } from '../lib/loadTypes'

// Las más próximas primero: un mensaje con todo se deja de leer.
const MAX_ORDERS = 5

// "Sáb 8 nov". La fecha viene con la hora de Lima: se arma con sus números
// para que el huso del navegador no la corra un día.
function shortDate(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const text = new Date(y, m - 1, d).toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })
  return text.replace(/\./g, '').replace(',', '').replace(/^./, (c) => c.toUpperCase())
}

function orderLine(order) {
  const route = [order.origin_district, order.destination_district].filter(Boolean).join(' → ')
  const load = [loadTypeLabel(order.load_type), cargoWeightLabel(order.cargo_weight_kg)].filter(Boolean).join(', ')
  return `• ${[shortDate(order.appointment_date), route].filter(Boolean).join(' · ')} (${load.toLowerCase()})\n`
    + `  ${window.location.origin}/quotation/${order.token}`
}

// Con los links de cotizar de cada orden, que no piden contraseña (el
// backoffice sí, y no hay cómo recuperarla).
export function reminderMessage(company) {
  const shown = company.orders.slice(0, MAX_ORDERS)
  const count = company.orders.length
  const lines = [
    `Hola ${company.name}, tienes ${count === 1 ? '1 pedido esperando' : `${count} pedidos esperando`} tu cotización en Chalán:`,
    '',
    ...shown.map(orderLine),
  ]
  if (count > shown.length) lines.push(`…y ${count - shown.length} más, te los mandamos después.`)
  lines.push('', 'Si no puedes alguno, ábrelo y marca que no puedes, así no te lo volvemos a mandar.')
  return lines.join('\n')
}

// El teléfono de las empresas se guarda como lo escribieron: con o sin +51.
function whatsappUrl(company) {
  const digits = (company.phone || '').replace(/\D/g, '')
  const number = digits.length === 9 ? `51${digits}` : digits
  return `https://wa.me/${number}?text=${encodeURIComponent(reminderMessage(company))}`
}

// Por transportista, lo que no cotizó ni rechazó de las órdenes pendientes que
// ya se le mandaron, con un botón que abre WhatsApp (el de Chalán, donde esté
// abierto) con el mensaje ya escrito. Sin teléfono, el mensaje se copia.
export default function CarrierReminders() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['carrier-reminders'],
    queryFn: () => client.get('/api/orders/carrier-reminders').then(({ data }) => data),
  })

  return (
    <Card title="Recordar a transportistas" className="mb-4">
      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : isError ? (
        <p className="text-sm text-amber-700">
          No se pudo cargar.{' '}
          <button type="button" onClick={() => refetch()} className="font-medium underline">Reintentar</button>
        </p>
      ) : data.companies.length === 0 ? (
        <p className="text-sm text-gray-400">
          {data.orders_count === 0
            ? 'No hay órdenes pendientes esperando cotizaciones.'
            : 'Todos los transportistas cotizaron o rechazaron las órdenes pendientes.'}
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs text-gray-400">
            Órdenes pendientes ya avisadas, con fecha desde hoy y sin transportista elegido, que cada uno no cotizó
            ni rechazó. WhatsApp se abre con el mensaje escrito: hasta {MAX_ORDERS}, las más próximas, con su link para cotizar.
          </p>
          <ul className="divide-y divide-gray-100">
            {data.companies.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-400">
                    {c.orders.length === 1 ? '1 por cotizar' : `${c.orders.length} por cotizar`}
                    {' · '}#{c.orders.map((o) => o.id).join(', #')}
                    {c.phone ? ` · WhatsApp ${c.phone}` : ' · Sin WhatsApp'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {c.phone ? (
                    <>
                      <CopyButton text={c.phone} label="Copiar número" />
                      <a
                        href={whatsappUrl(c)}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700"
                      >
                        Abrir WhatsApp
                      </a>
                    </>
                  ) : (
                    <CopyButton text={reminderMessage(c)} label="Copiar mensaje" />
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
