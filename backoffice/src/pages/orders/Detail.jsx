import { useEffect, useState } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'
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

const money = (n) =>
  `S/ ${Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function MoneyRow({ label, value, indent, strong, muted }) {
  return (
    <div className="flex justify-between items-baseline py-1.5">
      <span className={`text-sm ${indent ? 'pl-4 ' : ''}${muted ? 'text-gray-400' : 'text-gray-600'}`}>
        {label}
      </span>
      <span className={`text-sm tabular-nums ${strong ? 'font-bold text-gray-900' : muted ? 'text-gray-400' : 'text-gray-700'}`}>
        {value}
      </span>
    </div>
  )
}

function FinancialsCard({ f }) {
  if (!f) return null
  return (
    <div className="bg-white rounded-xl shadow p-5">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Desglose</h3>
        {f.effective_fee_rate != null && (
          <span className="text-xs text-gray-400">
            comisión {(f.effective_fee_rate * 100).toFixed(1)}%
          </span>
        )}
      </div>

      {f.is_estimate && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded p-2 mb-2">
          Estimado con las tasas de hoy: el cliente todavía no elige cotización.
        </p>
      )}

      {/* Órdenes cerradas antes de trasladar el IGV al cliente: el total
          grabado manda, pero conviene ver cuánto margen se fue en impuesto. */}
      {!f.is_estimate && f.current_fee_rate != null
        && f.effective_fee_rate < f.current_fee_rate - 0.0001 && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded p-2 mb-2">
          Cotizada al {(f.effective_fee_rate * 100).toFixed(1)}%, antes de trasladar el IGV al
          cliente: Chalán asumió {money(f.platform_igv)}. Hoy, al{' '}
          {(f.current_fee_rate * 100).toFixed(1)}%, el mismo servicio se cotizaría en{' '}
          {money(f.total_at_current_rate)}.
        </p>
      )}

      <div className="divide-y divide-gray-100">
        <MoneyRow label="Transportista (efectivo)" value={money(f.carrier_amount)} />
        {f.agent_commission > 0 && (
          <MoneyRow
            label={`Comisión agente${f.agent_code ? ` · ${f.agent_code}` : ''}`}
            value={money(f.agent_commission)}
          />
        )}
        {/* Comisión e IGV van al mismo nivel, no anidados: así las filas suman
            el total y se leen igual que la boleta (base imponible + IGV). */}
        <MoneyRow label="Comisión Chalán" value={money(f.platform_net)} strong />
        <MoneyRow label={`IGV ${Math.round(f.igv_rate * 100)}%`} value={money(f.platform_igv)} muted />
        <MoneyRow label="Total al cliente" value={money(f.total_amount)} strong />
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          A cobrar por adelantado
        </p>
        <p className="text-lg font-bold text-teal-600">{money(f.reservation_amount)}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Comisión + agente. El transportista cobra {money(f.carrier_amount)} en efectivo.
        </p>
      </div>
    </div>
  )
}

const PAYMENT_CONCEPTS = {
  reservation: 'Reserva (Yape a Chalán)',
  carrier_cash: 'Efectivo al transportista',
  order_total: 'Total de la orden (registro anterior)',
}

const PAYMENT_STATUSES = {
  pending: { label: 'Pendiente', className: 'bg-amber-50 text-amber-700' },
  paid: { label: 'Pagado', className: 'bg-teal-50 text-teal-700' },
  cancelled: { label: 'Cancelado', className: 'bg-gray-100 text-gray-500' },
}

function PaymentsCard({ payments, onSetStatus, savingId }) {
  if (!payments || payments.length === 0) return null

  const total = payments
    .filter((p) => p.status !== 'cancelled')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0)

  return (
    <div className="bg-white rounded-xl shadow p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Pagos</h3>

      <div className="divide-y divide-gray-100">
        {payments.map((p) => {
          const status = PAYMENT_STATUSES[p.status] || PAYMENT_STATUSES.pending
          const saving = savingId === p.id
          return (
            <div key={p.id} className="py-2.5">
              <div className="flex justify-between items-baseline gap-3">
                <span className="text-sm text-gray-600">
                  {PAYMENT_CONCEPTS[p.concept] || p.concept || 'Sin concepto'}
                </span>
                <span className="text-sm font-bold text-gray-900 tabular-nums">
                  {money(p.amount)}
                </span>
              </div>
              <div className="flex justify-between items-center gap-3 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded ${status.className}`}>
                  {status.label}
                </span>
                <div className="flex gap-3">
                  {p.status !== 'paid' && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => onSetStatus(p.id, 'paid')}
                      className="text-xs text-teal-600 hover:underline disabled:opacity-50"
                    >
                      {saving ? 'Guardando...' : 'Marcar como pagado'}
                    </button>
                  )}
                  {p.status === 'paid' && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => onSetStatus(p.id, 'pending')}
                      className="text-xs text-gray-400 hover:underline disabled:opacity-50"
                    >
                      {saving ? 'Guardando...' : 'Revertir'}
                    </button>
                  )}
                </div>
              </div>
              {p.paid_at && (
                <p className="text-xs text-gray-400 mt-1">
                  Confirmado el{' '}
                  {new Date(p.paid_at).toLocaleString('es-PE', {
                    dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima',
                  })}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-baseline">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Suma registrada
        </span>
        <span className="text-sm font-bold text-gray-900 tabular-nums">{money(total)}</span>
      </div>
    </div>
  )
}

function AddressCard({ title, addr }) {
  if (!addr) return null
  const hasFullDetails = 'country' in addr
  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
      <p className="text-xs font-bold text-teal-600 uppercase tracking-wide">{title}</p>
      <Field label="Calle" value={addr.street} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Piso" value={addr.floor_number} />
        {hasFullDetails && <Field label="Interior / Dpto." value={addr.interior_number} />}
        {hasFullDetails && <Field label="Código postal" value={addr.zip_code} />}
        {hasFullDetails && <Field label="País" value={addr.country} />}
        <Field label="Distancia desde parqueo" value={addr.approximate_distance_from_parking ? `${addr.approximate_distance_from_parking} m` : null} />
        <Field label="Tiene ascensor" value={addr.has_elevator ? 'Sí' : 'No'} />
      </div>
      {hasFullDetails && addr.map_url && (
        <a
          href={addr.map_url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-teal-600 hover:underline inline-block"
        >
          Ver en el mapa
        </a>
      )}
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
  // Editar orden es superadmin, igual que la ruta /orders/:orderId/edit y que
  // el enlace de la lista: mostrárselo a un admin sería mandarlo a un rebote.
  const isSuperadmin = user?.role === 'superadmin'
  const isCarrier = user?.role === 'carrier_company'
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState([])
  const [completing, setCompleting] = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [reviewUrl, setReviewUrl] = useState(null)
  const [payments, setPayments] = useState([])
  const [savingPaymentId, setSavingPaymentId] = useState(null)
  // Aviso que deja el formulario de edición al volver acá, p. ej. cuántas
  // cotizaciones se cancelaron al guardar.
  const location = useLocation()
  const [banner, setBanner] = useState(location.state?.message || null)

  useEffect(() => {
    client.get(`/api/orders/${orderId}`).then(({ data }) => {
      setOrder(data.order)
    }).finally(() => setLoading(false))

    if (isAdmin) {
      client.get(`/api/orders/${orderId}/payments`)
        .then(({ data }) => setPayments(data.payments))
        .catch(() => setPayments([]))
    }

    if (isAdmin) {
      client.get(`/api/orders/${orderId}/quotation-links`).then(({ data }) => {
        setCompanies(data.companies.map((c) => ({
          ...c,
          quotation_url: `${window.location.origin}/quotation/${c.token}`,
        })))
      })
    }
  }, [orderId])

  useEffect(() => {
    if (isAdmin && order?.order_status_id === 3) {
      client.get(`/api/orders/${orderId}/review-link`).then(({ data }) => {
        setReviewUrl(`${window.location.origin}/reviews/submit/${data.token}`)
      }).catch(() => setReviewUrl(null))
    }
  }, [orderId, isAdmin, order?.order_status_id])

  const canComplete = isCarrier
    && order?.order_status_id === 2
    && order?.existing_quotation?.quotation_status_id === 2

  function setPaymentStatus(paymentId, status) {
    setSavingPaymentId(paymentId)
    client.patch(`/api/orders/${orderId}/payments/${paymentId}`, { status })
      .then(({ data }) => {
        setPayments((prev) => prev.map((p) => (p.id === data.payment.id ? data.payment : p)))
      })
      .finally(() => setSavingPaymentId(null))
  }

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
      {banner && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4 text-sm text-teal-800 flex justify-between items-start gap-4">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)} className="text-teal-600 hover:text-teal-800 text-xs shrink-0">Cerrar</button>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <Link to="/orders" className="text-teal-600 hover:underline text-sm">← Órdenes</Link>
        <h1 className="text-2xl font-bold text-gray-900">Orden #{order.id}</h1>
        {isAdmin && (
          <div className="ml-auto flex items-center gap-2">
            {isSuperadmin && (
              <Link
                to={`/orders/${orderId}/edit`}
                className="text-sm bg-gray-100 hover:bg-gray-200 text-amber-700 px-3 py-1.5 rounded-lg"
              >
                Editar
              </Link>
            )}
            <Link
              to={`/orders/${orderId}/quotations`}
              className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg"
            >
              Ver cotizaciones
            </Link>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Summary */}
        <div className="bg-white rounded-xl shadow p-5 grid grid-cols-2 gap-4">
          {isAdmin && <Field label="Cliente" value={order.customer_name} />}
          <Field
            label="Fecha de mudanza"
            value={order.appointment_date ? new Date(order.appointment_date).toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Lima' }) : null}
          />
          <Field label="Presupuesto aproximado" value={order.approximate_budget ? `S/ ${order.approximate_budget}` : null} />
          <Field label="Pertenencias" value={order.comments} />
          {isAdmin && <Field label="Teléfono cliente" value={order.customer_phone || order.lead_phone} />}
          {isAdmin && <Field label="Monto total" value={order.total_amount ? `S/ ${order.total_amount}` : null} />}
        </div>

        {/* Desglose de la plata — solo admin: el transportista no debe ver el
            margen de Chalán ni el agente la comisión del otro. */}
        {isAdmin && <FinancialsCard f={order.financials} />}

        {/* Movimientos reales de plata, con la confirmación manual del yapeo:
            Yape personal no tiene webhook, alguien lo verifica a mano. */}
        {isAdmin && (
          <PaymentsCard
            payments={payments}
            onSetStatus={setPaymentStatus}
            savingId={savingPaymentId}
          />
        )}

        {/* Addresses */}
        <AddressCard title="Origen" addr={order.origin} />
        <AddressCard title="Destino" addr={order.destination} />

        {/* Servicios contratados (cargadores, embalaje, etc.) */}
        {order.services && (() => {
          const hasCargo = order.services.some((s) => s.name === 'cargo')
          const hasPackaging = order.services.some((s) => s.name === 'packaging')
          const otherServices = order.services.filter((s) => s.name !== 'cargo' && s.name !== 'packaging')
          return (
            <div className="bg-white rounded-xl shadow p-5">
              <p className="text-sm font-semibold text-gray-700 mb-3">Servicios</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Servicio de embalaje" value={hasPackaging ? 'Sí' : 'No'} />
                <Field
                  label="Cargadores"
                  value={hasCargo ? `Sí${order.loaders_quantity ? ` (${order.loaders_quantity})` : ''}` : 'No'}
                />
              </div>
              {otherServices.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {otherServices.map((s) => (
                    <span
                      key={s.id}
                      className="text-xs bg-teal-50 text-teal-700 px-3 py-1 rounded-full"
                      title={s.description || ''}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* Fotos de la mudanza — solo admin */}
        {isAdmin && order.images && order.images.length > 0 && (
          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">Fotos</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {order.images.map((img) => (
                <a key={img.id} href={img.url} target="_blank" rel="noreferrer">
                  <img
                    src={img.url}
                    alt="Foto de la mudanza"
                    className="w-full aspect-square object-cover rounded-lg border border-gray-200"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

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

        {/* Link de reseña — solo para admins, orden completada */}
        {isAdmin && reviewUrl && (
          <div className="bg-white rounded-xl shadow p-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-700">Link de reseña para el cliente</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Compártelo con el cliente para que califique el servicio.
              </p>
            </div>
            <CopyButton url={reviewUrl} />
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
