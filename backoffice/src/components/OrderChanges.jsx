import { useEffect, useState } from 'react'
import client from '../api/client'
import Card from './Card'
import OrderChangeEntries from './OrderChangeEntries'

// El historial de la orden desde que salió a transportistas: cada versión con
// lo que cambió respecto de la anterior (app/api/order/versions.py del API
// principal), y quién cotizó sobre una versión que ya no es la vigente. Solo
// para admins.

const CANCELLED = 3

const when = (iso) => new Date(iso).toLocaleString('es-PE', {
  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Lima',
})

function author(version) {
  if (version.author !== 'admin') return 'el cliente'
  return version.admin_name ? `Chalán (${version.admin_name})` : 'Chalán'
}

export default function OrderChanges({ orderId }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    client.get(`/api/orders/${orderId}/changes`).then(({ data }) => setData(data)).catch(() => setData(null))
  }, [orderId])

  // Solo la versión que se mandó, o ninguna: no hay cambios que mostrar.
  if (!data || data.versions.length < 2) return null

  const outdated = data.quotations.filter((q) => q.quotation_status_id !== CANCELLED
    && q.version_number != null && q.version_number < data.current_number)
  const versions = [...data.versions].reverse()

  return (
    <Card title="Historial de cambios">
      {outdated.length > 0 && (
        <p className="mb-3 rounded bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
          Cotizaron antes del último cambio:{' '}
          {outdated.map((q) => `${q.carrier_company_name || `Empresa #${q.carrier_company_id}`} (S/ ${q.amount}, versión ${q.version_number})`).join(', ')}
        </p>
      )}
      <ol className="space-y-4">
        {versions.map((version) => (
          <li key={version.number} className="border-l-2 border-gray-200 pl-3">
            <p className="text-xs text-gray-500">
              <span className="font-semibold text-gray-700">Versión {version.number}</span>
              {' · '}{when(version.created_date)}
              {version.number > 1 && <> · {author(version)}</>}
              {version.notified_at && (
                <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">avisada a transportistas</span>
              )}
            </p>
            <div className="mt-1.5">
              {version.number === 1
                ? <p className="text-sm text-gray-600">Lo que se mandó a los transportistas.</p>
                : <OrderChangeEntries entries={version.entries} />}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}
