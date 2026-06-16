import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'

const STATUS_LABEL = { 1: 'Pendiente', 2: 'En progreso', 3: 'Completado', 4: 'Cancelado' }
const fmt = (n) => n != null ? `S/ ${Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : '—'

export default function AdminReferredOrdersList() {
  const [orders, setOrders] = useState([])
  const [totalCommission, setTotalCommission] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get('/api/admin/referred-orders').then(({ data }) => {
      setOrders(data.orders)
      setTotalCommission(data.total_commission)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-gray-500 p-8">Cargando...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Órdenes referidas</h1>
      </div>

      <div className="bg-white rounded-xl shadow p-5 mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-1">Total comisiones de agentes</p>
        <p className="text-3xl font-bold text-teal-600">{fmt(totalCommission)}</p>
        <p className="text-xs text-gray-400 mt-1">
          Suma de todas las comisiones registradas (incluye completadas y canceladas)
        </p>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left"># Orden</th>
                <th className="px-4 py-3 text-left">Agente</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Origen</th>
                <th className="px-4 py-3 text-left">Destino</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Monto total</th>
                <th className="px-4 py-3 text-left">Comisión agente</th>
                <th className="px-4 py-3 text-left">Fecha referido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link to={`/orders/${o.id}`} className="text-teal-600 hover:underline">
                      #{o.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-800">{o.agent_name || '—'}</div>
                    {o.agent_email && (
                      <div className="text-xs text-gray-400">{o.agent_email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{o.customer_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {o.origin ? (
                      <div>
                        <div>{[o.origin.street, o.origin.neighborhood].filter(Boolean).join(', ') || '—'}</div>
                        <div className="text-xs text-gray-400">{[o.origin.city, o.origin.state].filter(Boolean).join(', ')}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {o.destination ? (
                      <div>
                        <div>{[o.destination.street, o.destination.neighborhood].filter(Boolean).join(', ') || '—'}</div>
                        <div className="text-xs text-gray-400">{[o.destination.city, o.destination.state].filter(Boolean).join(', ')}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {STATUS_LABEL[o.order_status_id] || o.order_status_id}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {fmt(o.total_amount)}
                  </td>
                  <td className="px-4 py-3 font-medium text-teal-600">
                    {o.commission != null ? fmt(o.commission) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {o.referred_date ? new Date(o.referred_date).toLocaleDateString('es-PE', { timeZone: 'America/Lima' }) : '—'}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    No hay órdenes referidas aún
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
