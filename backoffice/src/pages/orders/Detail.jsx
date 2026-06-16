import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import client from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-800 mt-0.5">{value || '—'}</p>
    </div>
  )
}

function AddressCard({ title, addr }) {
  if (!addr) return null
  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
      <p className="text-xs font-bold text-teal-600 uppercase tracking-wide">{title}</p>
      <Field label="Calle" value={addr.street} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Piso" value={addr.floor_number} />
      </div>
    </div>
  )
}

function CopyButton({ url }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="text-xs px-3 py-1.5 rounded-lg border border-teal-600 text-teal-600 hover:bg-teal-50 shrink-0"
    >
      {copied ? 'Copiado' : 'Copiar link'}
    </button>
  )
}

export default function OrderDetail() {
  const { orderId } = useParams()
  const { user } = useAuth()
  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin'
  const isCarrier = user?.role === 'carrier_company'
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState([])
  const [completing, setCompleting] = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)

  useEffect(() => {
    client.get(`/api/orders/${orderId}`).then(({ data }) => {
      setOrder(data.order)
    }).finally(() => setLoading(false))

    if (isAdmin) {
      client.get(`/api/orders/${orderId}/quotation-links`).then(({ data }) => {
        setCompanies(data.companies.map((c) => ({
          ...c,
          quotation_url: `${window.location.origin}/quotation/${c.token}`,
        })))
      })
    }
  }, [orderId])

  const canComplete = isCarrier
    && order?.order_status_id === 2
    && order?.existing_quotation?.quotation_status_id === 2

  function handleComplete() {
    setCompleting(true)
    client.patch(`/api/orders/${orderId}/complete`)
      .then(() => setOrder(prev => ({ ...prev, order_status_id: 3 })))
      .finally(() => { setCompleting(false); setConfirmComplete(false) })
  }

  if (loading) return <p className="text-gray-500 p-8">Cargando...</p>
  if (!order) return <p className="text-red-500 p-8">Orden no encontrada</p>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/orders" className="text-teal-600 hover:underline text-sm">← Órdenes</Link>
        <h1 className="text-2xl font-bold text-gray-900">Orden #{order.id}</h1>
        {isAdmin && (
          <Link
            to={`/orders/${orderId}/quotations`}
            className="ml-auto text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg"
          >
            Ver cotizaciones
          </Link>
        )}
      </div>

      <div className="space-y-4">
        {/* Summary */}
        <div className="bg-white rounded-xl shadow p-5 grid grid-cols-2 gap-4">
          <Field
            label="Fecha de mudanza"
            value={order.appointment_date ? new Date(order.appointment_date).toLocaleDateString('es-PE', { dateStyle: 'long', timeZone: 'America/Lima' }) : null}
          />
          <Field label="Kilómetros" value={order.total_kilometers} />
          <Field label="Presupuesto aproximado" value={order.approximate_budget ? `S/ ${order.approximate_budget}` : null} />
          <Field label="Comentarios" value={order.comments} />
          {isAdmin && <Field label="Teléfono cliente" value={order.customer_phone} />}
        </div>

        {/* Addresses */}
        <AddressCard title="Origen" addr={order.origin} />
        <AddressCard title="Destino" addr={order.destination} />

        {/* Existing quotation */}
        {order.existing_quotation && (
          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-sm font-semibold text-gray-700 mb-2">Tu cotización enviada</p>
            <p className="text-2xl font-bold text-teal-600">S/ {order.existing_quotation.amount}</p>
            <p className="text-xs text-gray-400 mt-1">
              Enviada el {new Date(order.existing_quotation.created_date).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}
            </p>
          </div>
        )}

        {/* Completar orden — solo para el carrier asignado con orden in_progress */}
        {canComplete && (
          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-sm font-semibold text-gray-700 mb-1">¿Completaste el servicio?</p>
            <p className="text-xs text-gray-400 mb-4">
              Marca la orden como completada una vez que hayas finalizado la mudanza con el cliente.
            </p>
            {!confirmComplete ? (
              <button
                onClick={() => setConfirmComplete(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-5 py-2 rounded-lg"
              >
                Marcar como completada
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-600">¿Confirmas que el servicio fue completado?</p>
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg"
                >
                  {completing ? 'Guardando...' : 'Confirmar'}
                </button>
                <button
                  onClick={() => setConfirmComplete(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}

        {/* Orden completada — mensaje de confirmación */}
        {isCarrier && order.order_status_id === 3 && order.existing_quotation?.quotation_status_id === 2 && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-5">
            <p className="text-sm font-semibold text-teal-700">✓ Orden completada</p>
            <p className="text-xs text-teal-600 mt-0.5">Este servicio ha sido marcado como completado.</p>
          </div>
        )}

        {/* CTA button — solo para empresas transportistas */}
        {!isAdmin && order.quotation_url && (
          <div className="bg-white rounded-xl shadow p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-700">
                {order.existing_quotation ? 'Actualizar cotización' : 'Enviar cotización'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Se abrirá la plataforma Chalán donde puedes ingresar el monto y ver todos los detallles de la orden.
              </p>
            </div>
            <a
              href={order.quotation_url}
              target="_blank"
              rel="noreferrer"
              className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-5 py-2 rounded-lg shrink-0"
            >
              {order.existing_quotation ? 'Modificar cotización' : 'Cotizar ahora'}
            </a>
          </div>
        )}

        {/* Links de cotización por empresa — solo para admins */}
        {isAdmin && companies.length > 0 && (
          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">Links de cotización por empresa</p>
            <div className="space-y-2">
              {companies.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-700 truncate">{c.name}</span>
                  <CopyButton url={c.quotation_url} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
