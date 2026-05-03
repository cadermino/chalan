import { useEffect, useState } from 'react'
import client from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

const STATUS_LABEL = { 1: 'Pendiente', 2: 'En progreso', 3: 'Completado', 4: 'Cancelado' }
const SITE_URL = import.meta.env.VITE_SITE_URL || window.location.origin

export default function ReferredOrdersList() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [commissionBalance, setCommissionBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const referralLink = user?.referral_code
    ? `${SITE_URL}/?ref=${user.referral_code}`
    : null

  const copyLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  useEffect(() => {
    client.get('/api/referred-orders').then(({ data }) => {
      setOrders(data.orders)
      setCommissionBalance(data.commission_balance)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <p className="text-gray-500 p-8">Cargando...</p>
  }

  return (
    <div>
      {referralLink && (
        <div className="bg-white rounded-xl shadow p-5 mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-2">Tu link de referencia</p>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-gray-100 text-sm text-gray-800 px-3 py-2 rounded-lg truncate">
              {referralLink}
            </code>
            <button
              onClick={copyLink}
              className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-lg shrink-0 transition-colors"
            >
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Comparte este link con tus clientes. Las ordenes creadas con tu referencia aparecen aqui.
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-5 mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-1">Comisiones pendientes</p>
        <p className="text-3xl font-bold text-teal-600">S/ {commissionBalance.toFixed(2)}</p>
        <p className="text-xs text-gray-400 mt-1">
          Suma de comisiones de ordenes activas (no incluye completadas ni canceladas)
        </p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mis ordenes referidas</h1>
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
                <th className="px-4 py-3 text-left">Fecha mudanza</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Comision</th>
                <th className="px-4 py-3 text-left">Fecha referido</th>
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
                    {o.appointment_date ? new Date(o.appointment_date).toLocaleDateString('es-PE') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {STATUS_LABEL[o.order_status_id] || o.order_status_id}
                  </td>
                  <td className="px-4 py-3 font-medium text-teal-600">
                    {o.commission ? `S/ ${o.commission.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {o.referred_date ? new Date(o.referred_date).toLocaleDateString('es-PE') : '—'}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No hay ordenes referidas en este momento
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
