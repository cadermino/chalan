import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import client from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

const STATUS_LABEL = { 1: 'Activa', 2: 'Seleccionada', 3: 'Cancelada' }

const fmt = (n) => n != null ? `S/ ${Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : '—'

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

export default function OrderQuotations() {
  const { orderId } = useParams()
  const { user } = useAuth()
  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin'
  const [quotations, setQuotations] = useState([])
  const [orderStatusId, setOrderStatusId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    client.get(`/api/orders/${orderId}/quotations`)
      .then(({ data }) => {
        setQuotations(data.quotations)
        setOrderStatusId(data.order_status_id)
      })
      .finally(() => setLoading(false))
  }, [orderId])

  const orderEditable = orderStatusId !== 2

  function startEdit(q) {
    setEditingId(q.id)
    setEditValue(String(q.amount ?? ''))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValue('')
  }

  function saveEdit(quotationId) {
    const amount = parseFloat(editValue)
    if (!amount || amount <= 0) return
    setSaving(true)
    client.patch(`/api/orders/${orderId}/quotations/${quotationId}`, { amount })
      .then(({ data }) => {
        setQuotations(prev => prev.map(q =>
          q.id === quotationId
            ? { ...q, amount: data.amount, total_amount: data.total_amount }
            : q
        ))
        cancelEdit()
      })
      .finally(() => setSaving(false))
  }

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
                {isAdmin && <th className="px-4 py-3 text-left">Bruto transportista</th>}
                {isAdmin && <th className="px-4 py-3 text-left">Neto cliente</th>}
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

                  {isAdmin && (
                    <td className="px-4 py-3">
                      {editingId === q.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400 text-xs">S/</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(q.id); if (e.key === 'Escape') cancelEdit() }}
                            autoFocus
                            className="w-24 border border-teal-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                          <button
                            onClick={() => saveEdit(q.id)}
                            disabled={saving}
                            className="text-xs text-teal-600 hover:text-teal-800 font-medium disabled:opacity-50"
                          >
                            {saving ? '...' : 'OK'}
                          </button>
                          <button onClick={cancelEdit} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-900">{fmt(q.amount)}</span>
                          {orderEditable && q.quotation_status_id === 1 && (
                            <button
                              onClick={() => startEdit(q)}
                              className="text-gray-400 hover:text-teal-600 transition-colors"
                              title="Editar bruto"
                            >
                              <PencilIcon />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}

                  {isAdmin && (
                    <td className="px-4 py-3 text-teal-700 font-medium">
                      {editingId === q.id && editValue
                        ? fmt(parseFloat(editValue) * (q.total_amount / (q.amount || 1)))
                        : fmt(q.total_amount)}
                    </td>
                  )}

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
                  <td colSpan={isAdmin ? 8 : 6} className="px-4 py-8 text-center text-gray-400">
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
