import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'

const STATUS_LABEL = { 1: 'Nuevo', 2: 'Enviado', 3: 'En progreso', 4: 'Finalizado' }

export default function OrdersList() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get('/api/orders/pending').then(({ data }) => {
      setOrders(data.orders)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <p className="text-gray-500 p-8">Cargando...</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Órdenes pendientes</h1>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left"># Orden</th>
                <th className="px-4 py-3 text-left">Origen</th>
                <th className="px-4 py-3 text-left">Destino</th>
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
                  <td className="px-4 py-3 text-gray-600">
                    {o.origin ? `${o.origin.city || ''} ${o.origin.neighborhood || ''}`.trim() || '—' : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {o.destination ? `${o.destination.city || ''} ${o.destination.neighborhood || ''}`.trim() || '—' : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {o.appointment_date ? new Date(o.appointment_date).toLocaleDateString('es-PE') : '—'}
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
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No hay órdenes pendientes en este momento
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
