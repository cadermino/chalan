import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import client from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

const STATUS_LABEL = { 1: 'Activa', 2: 'Seleccionada', 3: 'Cancelada' }

const fmt = (n) => n != null ? `S/ ${Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : '—'

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function BanIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </svg>
  )
}

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
  const [acceptingId, setAcceptingId] = useState(null)
  const [cancelingId, setCancelingId] = useState(null)
  // Cancelar no se puede deshacer desde acá, así que pide un segundo clic en
  // vez de un confirm() del navegador, que corta la página entera.
  const [confirmCancelId, setConfirmCancelId] = useState(null)
  const [error, setError] = useState(null)

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

  function cancelQuotation(quotationId) {
    setCancelingId(quotationId)
    setError(null)
    client.patch(`/api/orders/${orderId}/quotations/${quotationId}/cancel`)
      .then(({ data }) => {
        setQuotations(prev => prev.map(q =>
          q.id === quotationId ? { ...q, quotation_status_id: data.quotation_status_id } : q
        ))
        setConfirmCancelId(null)
      })
      .catch(err => setError(err.response?.data?.message || 'No se pudo cancelar la cotización'))
      .finally(() => setCancelingId(null))
  }

  function acceptQuotation(quotationId) {
    setAcceptingId(quotationId)
    client.patch(`/api/orders/${orderId}/quotations/${quotationId}/accept`)
      .then(() => {
        setQuotations(prev => prev.map(q => ({
          ...q,
          quotation_status_id: q.id === quotationId ? 2 : (q.quotation_status_id === 2 ? 1 : q.quotation_status_id),
        })))
      })
      .finally(() => setAcceptingId(null))
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-800 flex justify-between items-start gap-4">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 text-xs shrink-0">Cerrar</button>
        </div>
      )}

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
                {isAdmin && <th className="px-4 py-3 text-left"></th>}
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
                    {q.created_date ? new Date(q.created_date).toLocaleDateString('es-PE', { timeZone: 'America/Lima' }) : '—'}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      {orderStatusId === 1 && q.quotation_status_id === 1 && (
                        confirmCancelId === q.id ? (
                          // Segundo paso: el texto dice qué va a pasar, porque
                          // acá un ícono solo sería ambiguo entre confirmar y
                          // desistir.
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500">¿Cancelar?</span>
                            <button
                              onClick={() => cancelQuotation(q.id)}
                              disabled={cancelingId === q.id}
                              className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                            >
                              {cancelingId === q.id ? 'Cancelando...' : 'Sí'}
                            </button>
                            <button
                              onClick={() => setConfirmCancelId(null)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => acceptQuotation(q.id)}
                              disabled={acceptingId === q.id}
                              title="Aceptar esta cotización a nombre del cliente"
                              aria-label="Aceptar esta cotización a nombre del cliente"
                              className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50 disabled:opacity-50"
                            >
                              <CheckIcon />
                            </button>
                            <button
                              onClick={() => { setError(null); setConfirmCancelId(q.id) }}
                              title="Cancelar esta cotización: deja de estar disponible para el cliente"
                              aria-label="Cancelar esta cotización"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <BanIcon />
                            </button>
                          </div>
                        )
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {quotations.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 5} className="px-4 py-8 text-center text-gray-400">
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
