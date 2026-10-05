import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import client from '../../api/client'
import ServiceRequestView, { formatTimestamp } from '../../components/ServiceRequestView'

const STATUS_LABEL = { draft: 'Incompleta', submitted: 'Enviada', cancelled: 'Cancelada' }

function CopyButton({ url }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
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
      {copied ? 'Copiado' : 'Copiar link'}
    </button>
  )
}

// El link se arma con el origen actual, así sirve igual en local y en producción.
function carrierUrl(token) {
  return `${window.location.origin}${import.meta.env.BASE_URL}carrier-view/${token}`
}

export default function ServiceRequestDetail() {
  const { id } = useParams()
  const [request, setRequest] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Cancelar avisa a los transportistas, así que pide un segundo clic (como las
  // cotizaciones) en vez de un confirm() del navegador, que corta la página entera.
  const [confirmingCancel, setConfirmingCancel] = useState(false)

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
                  <CopyButton url={carrierUrl(link.token)} />
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
