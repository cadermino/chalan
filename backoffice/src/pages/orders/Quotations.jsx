import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import client from '../../api/client'

const STATUS_LABEL = { 1: 'Activa', 2: 'Cancelada', 3: 'Completada' }

export default function OrderQuotations() {
  const { orderId } = useParams()
  const [quotations, setQuotations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get(`/api/orders/${orderId}/quotations`)
      .then(({ data }) => setQuotations(data.quotations))
      .finally(() => setLoading(false))
  }, [orderId])

  if (loading) return <p className="text-gray-500 p-8">Cargando...</p>

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/orders/${orderId}`} className="text-teal-600 hover:underline text-sm">
          ← Orden #{orderId}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Cotizaciones</h1>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left"># Cotización</th>
                <th className="px-4 py-3 text-left">Empresa transportista</th>
                <th className="px-4 py-3 text-left">Monto</th>
                <th className="px-4 py-3 text-left">Seleccionada</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quotations.map((q) => (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">#{q.id}</td>
                  <td className="px-4 py-3 text-gray-700">{q.carrier_company_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-900 font-medium">
                    {q.amount != null ? `S/ ${q.amount.toLocaleString('es-PE')}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {q.selected
                      ? <span className="inline-block bg-teal-100 text-teal-700 text-xs font-semibold px-2 py-0.5 rounded-full">Sí</span>
                      : <span className="text-gray-400 text-xs">No</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {STATUS_LABEL[q.quotation_status_id] || q.quotation_status_id}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {q.created_date ? new Date(q.created_date).toLocaleDateString('es-PE') : '—'}
                  </td>
                </tr>
              ))}
              {quotations.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Esta orden aún no tiene cotizaciones
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
