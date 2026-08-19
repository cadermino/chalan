import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

const STATUS_LABEL = { 1: 'Pendiente', 2: 'En progreso', 3: 'Completado', 4: 'Cancelado' }

const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: '1', label: 'Pendiente' },
  { key: '2', label: 'En progreso' },
  { key: '3', label: 'Completado' },
  { key: '4', label: 'Cancelado' },
]

export default function OrdersList() {
  const { user } = useAuth()
  const isSuperadmin = user?.role === 'superadmin'
  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin'
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    setLoading(true)
    const query = isAdmin ? `?status=${statusFilter}` : ''
    client.get(`/api/orders/pending${query}`).then(({ data }) => {
      setOrders(data.orders)
    }).finally(() => setLoading(false))
  }, [isAdmin, statusFilter])

  if (loading && orders.length === 0) {
    return <p className="text-gray-500 p-8">Cargando...</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Órdenes</h1>
      </div>

      {isAdmin && (
        <div className="flex gap-2 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`text-sm px-3 py-1.5 rounded-lg border ${
                statusFilter === f.key
                  ? 'bg-teal-600 border-teal-600 text-white'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left"># Orden</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                {isAdmin && <th className="px-4 py-3 text-left">Teléfono</th>}
                <th className="px-4 py-3 text-left">Origen</th>
                <th className="px-4 py-3 text-left">Destino</th>
                <th className="px-4 py-3 text-left">Creación</th>
                <th className="px-4 py-3 text-left">Fecha mudanza</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Cotización</th>
                <th className="px-4 py-3 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">#{o.id}</td>
                  <td className="px-4 py-3 text-gray-700">{o.customer_name || '—'}</td>
                  {isAdmin && <td className="px-4 py-3 text-gray-600">{o.customer_phone || o.lead_phone || '—'}</td>}
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
                  <td className="px-4 py-3 text-gray-500">
                    {o.created_date ? (
                      <div>
                        <div>{new Date(o.created_date).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}</div>
                        <div className="text-xs text-gray-400">{new Date(o.created_date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {o.appointment_date ? (
                      <div>
                        <div>{new Date(o.appointment_date).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}</div>
                        <div className="text-xs text-gray-400">{new Date(o.appointment_date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {STATUS_LABEL[o.order_status_id] || o.order_status_id}
                  </td>
                  <td className="px-4 py-3">
                    {o.has_quotation
                      ? <span className="text-green-600 font-medium">Enviada</span>
                      : <span className="text-amber-500 font-medium">Pendiente</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <Link
                        to={`/orders/${o.id}`}
                        className="text-teal-600 hover:underline"
                      >
                        Ver detalle
                      </Link>
                      {isAdmin && (
                        <Link
                          to={`/orders/${o.id}/quotations`}
                          className="text-indigo-600 hover:underline"
                        >
                          Cotizaciones
                        </Link>
                      )}
                      {isSuperadmin && (
                        <Link
                          to={`/orders/${o.id}/edit`}
                          className="text-amber-600 hover:underline"
                        >
                          Editar
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} className="px-4 py-8 text-center text-gray-400">
                    No hay órdenes para este filtro
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
