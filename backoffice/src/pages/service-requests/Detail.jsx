import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import client from '../../api/client'
import ServiceRequestView, { formatDay, formatMoney, formatTimestamp } from '../../components/ServiceRequestView'

const STATUS_LABEL = { draft: 'Incompleta', submitted: 'Enviada', cancelled: 'Cancelada' }

function CopyButton({ text, label = 'Copiar link' }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-lg border border-teal-600 px-3 py-1.5 text-xs text-teal-600 hover:bg-teal-50"
    >
      {copied ? 'Copiado' : label}
    </button>
  )
}

// El link se arma con el origen actual, así sirve igual en local y en producción.
function carrierUrl(token) {
  return `${window.location.origin}${import.meta.env.BASE_URL}carrier-view/${token}`
}

// Mensaje listo para pegarle al cliente por WhatsApp, con el total que ya incluye la comisión.
function customerMessage(request, quotation) {
  const service = (request.service_type?.name || 'servicio').toLowerCase()
  const where = request.neighborhood ? ` en ${request.neighborhood}` : ''
  return `Hola, tenemos tu cotización de ${service} para el ${formatDay(request.preferred_date)}${where}: ${formatMoney(quotation.total_amount)}. ¿Confirmamos?`
}

function Quotations({ request, busy, confirmingId, onAskConfirm, onSelect }) {
  const quotations = request.quotations || []
  const canPick = request.status === 'submitted'
  const selected = quotations.find((q) => q.status === 'selected')
  const lowest = quotations.length > 1 ? Math.min(...quotations.map((q) => q.amount)) : null
  const feePercent = Number((request.platform_fee_rate * 100).toFixed(2))

  return (
    <section className="mt-4 rounded-xl bg-white p-5 shadow">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Cotizaciones ({quotations.length})
      </h2>
      {quotations.length === 0
        ? <p className="text-sm text-gray-500">Aún no llegan cotizaciones.</p>
        : (
          <>
            <ul className="divide-y divide-gray-100">
              {quotations.map((q) => {
                const isSelected = q.status === 'selected'
                return (
                  <li key={q.id} className={`py-3 ${isSelected ? 'rounded-lg bg-teal-50 px-3' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {q.carrier_company_name}
                          {isSelected && <span className="ml-2 rounded-full bg-teal-600 px-2 py-0.5 text-xs text-white">Elegida</span>}
                          {!isSelected && q.amount === lowest && (
                            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Más barata</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">Actualizada {formatTimestamp(q.updated_date)}</p>
                        {q.note && <p className="mt-1 text-sm text-gray-600">“{q.note}”</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Transportista: {formatMoney(q.amount)}</p>
                        <p className="text-lg font-bold text-gray-900">{formatMoney(q.total_amount)}</p>
                        <p className="text-xs text-gray-400">total para el cliente</p>
                      </div>
                    </div>

                    {canPick && !isSelected && confirmingId !== q.id && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onAskConfirm(q.id)}
                        className="mt-2 rounded-lg border border-teal-600 px-3 py-1.5 text-xs text-teal-600 hover:bg-teal-50 disabled:opacity-50"
                      >
                        Elegir
                      </button>
                    )}
                    {canPick && !isSelected && confirmingId === q.id && (
                      <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 p-3">
                        <p className="flex-1 text-sm text-teal-800">
                          {selected
                            ? `Esto reemplaza a ${selected.carrier_company_name} como cotización elegida.`
                            : `Elegir a ${q.carrier_company_name} a ${formatMoney(q.total_amount)} para el cliente.`}
                        </p>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onSelect(q.id)}
                          className="rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                        >
                          Sí, elegir
                        </button>
                        <button type="button" disabled={busy} onClick={() => onAskConfirm(null)} className="text-sm text-gray-600 hover:underline">
                          No
                        </button>
                      </div>
                    )}
                    {isSelected && (
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <CopyButton text={customerMessage(request, q)} label="Copiar mensaje para el cliente" />
                        {request.whatsapp && (
                          <Link to={`/whatsapp/${encodeURIComponent(request.whatsapp)}`} className="text-sm text-teal-600 hover:underline">
                            Abrir chat con el cliente
                          </Link>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-xs text-gray-400">
              El total incluye la comisión de Chalán ({feePercent}%). Una vez elegida, queda congelado aunque la comisión cambie.
            </p>
          </>
        )}
    </section>
  )
}

export default function ServiceRequestDetail() {
  const { id } = useParams()
  const [request, setRequest] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Cancelar avisa a los transportistas, así que pide un segundo clic (como las
  // cotizaciones) en vez de un confirm() del navegador, que corta la página entera.
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  // Elegir una cotización también pide un segundo clic: le dice al equipo cuál es el
  // precio del cliente, y elegir otra después reemplaza a la anterior.
  const [confirmingSelectId, setConfirmingSelectId] = useState(null)

  const load = () =>
    client.get(`/api/service-requests/${id}`)
      .then(({ data }) => setRequest(data.service_request))
      .catch((err) => setError(err.response?.status === 404 ? 'La solicitud no existe.' : 'No se pudo cargar.'))

  useEffect(() => { load() }, [id])

  const resend = async () => {
    setBusy(true)
    try {
      const { data } = await client.post(`/api/service-requests/${id}/notify-carriers`)
      const count = data.notified_carrier_ids.length
      toast.success(count ? `Avisamos a ${count} transportista(s)` : 'No había transportistas pendientes de avisar')
      await load()
    } catch (err) {
      toast.error(err.response?.status === 409
        ? 'Solo se puede reenviar una solicitud ya enviada por el cliente'
        : 'No se pudo reenviar')
    } finally {
      setBusy(false)
    }
  }

  const selectQuotation = async (quotationId) => {
    setBusy(true)
    try {
      await client.post(`/api/service-requests/${id}/quotations/${quotationId}/select`)
      toast.success('Cotización elegida')
      setConfirmingSelectId(null)
      await load()
    } catch (err) {
      toast.error(err.response?.status === 409
        ? 'La solicitud ya no admite elegir (¿fue cancelada?)'
        : 'No se pudo elegir la cotización')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    setBusy(true)
    try {
      await client.patch(`/api/service-requests/${id}`, { status: 'cancelled' })
      toast.success('Solicitud cancelada')
      setConfirmingCancel(false)
      await load()
    } catch (err) {
      toast.error('No se pudo cancelar')
    } finally {
      setBusy(false)
    }
  }

  if (error) return <p className="py-10 text-center text-gray-500">{error}</p>
  if (!request) return <p className="py-10 text-center text-gray-400">Cargando...</p>

  const pending = request.links.filter((l) => !l.notified).length
  const notifiedAt = Object.fromEntries(request.notifications.map((n) => [n.carrier_company_id, n.sent_at]))

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/service-requests" className="text-sm text-teal-600 hover:underline">← Embalajes</Link>
        <h1 className="text-2xl font-bold text-gray-900">Solicitud #{request.id}</h1>
        <span className="rounded-full bg-gray-200 px-3 py-0.5 text-xs font-medium text-gray-700">
          {STATUS_LABEL[request.status] || request.status}
        </span>
      </div>

      <div className="mb-4 rounded-xl bg-white p-5 shadow">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Cliente</h2>
        {request.whatsapp
          ? (
            <p className="text-gray-900">
              WhatsApp {request.whatsapp}{' · '}
              <Link to={`/whatsapp/${encodeURIComponent(request.whatsapp)}`} className="text-teal-600 hover:underline">
                Abrir chat
              </Link>
            </p>
          )
          : <p className="text-sm text-gray-400">Aún no dejó su WhatsApp (no terminó el formulario).</p>}
      </div>

      <ServiceRequestView request={request} />

      <Quotations
        request={request}
        busy={busy}
        confirmingId={confirmingSelectId}
        onAskConfirm={setConfirmingSelectId}
        onSelect={selectQuotation}
      />

      <div className="mt-4 rounded-xl bg-white p-5 shadow">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Transportistas</h2>
        {request.links.length === 0
          ? (
            <p className="text-sm text-gray-500">
              Ninguna empresa activa ofrece este servicio. Actívalo en el formulario de la empresa.
            </p>
          )
          : (
            <ul className="divide-y divide-gray-100">
              {request.links.map((link) => (
                <li key={link.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{link.name}</p>
                    <p className="text-xs text-gray-400">
                      {link.notified ? `Avisado ${formatTimestamp(notifiedAt[link.id])}` : 'Sin avisar'}
                    </p>
                  </div>
                  <CopyButton text={carrierUrl(link.token)} />
                </li>
              ))}
            </ul>
          )}

        <div className="mt-4 flex flex-wrap gap-3">
          {request.status === 'submitted' && (
            <button
              type="button"
              disabled={busy || pending === 0}
              onClick={resend}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              Reenviar a transportistas no avisados{pending ? ` (${pending})` : ''}
            </button>
          )}
          {request.status !== 'cancelled' && !confirmingCancel && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmingCancel(true)}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Cancelar solicitud
            </button>
          )}
          {request.status !== 'cancelled' && confirmingCancel && (
            <div className="flex w-full flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="flex-1 text-sm text-red-700">
                Los transportistas verán que ya no hace falta cotizar. ¿Cancelar la solicitud?
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={cancel}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Sí, cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmingCancel(false)}
                className="text-sm text-gray-600 hover:underline"
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
