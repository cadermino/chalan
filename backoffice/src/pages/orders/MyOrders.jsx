import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'

export default function MyOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get('/api/orders/my-orders').then(({ data }) => {
      setOrders(data.orders)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <p className="text-gray-500 p-8">Cargando...</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mis órdenes</h1>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left"># Orden</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Origen</th>
                <th className="px-4 py-3 text-left">Destino</th>
                <th className="px-4 py-3 text-left">Creación</th>
                <th className="px-4 py-3 text-left">Fecha mudanza</th>
                <th className="px-4 py-3 text-left">Monto cotizado</th>
                <th className="px-4 py-3 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">#{o.id}</td>
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
                  <td className="px-4 py-3 text-gray-500">
                    {o.created_date ? new Date(o.created_date).toLocaleDateString('es-PE', { timeZone: 'America/Lima' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {o.appointment_date ? new Date(o.appointment_date).toLocaleDateString('es-PE', { timeZone: 'America/Lima' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-medium">
                    {o.quotation_amount != null
                      ? `S/ ${Number(o.quotation_amount).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/orders/${o.id}`}
                      className="text-teal-600 hover:underline"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No tienes órdenes en progreso en este momento
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
