import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'
import { shortDate } from '../../lib/shortDate'

// Las solicitudes de los servicios de la empresa (embalaje, armado, pintura…).
// El aviso por correo o WhatsApp trae un link que vence a los 10 días: desde acá
// la empresa vuelve a cualquiera para cotizarla, con un link nuevo que da la API.

const STATE = {
  open: null,
  selected_pending: { label: 'Te eligieron · confirmando el pago', className: 'bg-amber-50 text-amber-700' },
  selected_mine: { label: 'Te eligieron', className: 'bg-green-50 text-green-700' },
}

const soles = (n) => `S/ ${Number(n).toLocaleString('es-PE')}`

function todayInLima() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
}

function Status({ request }) {
  const won = STATE[request.quotation_state]
  if (won) return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${won.className}`}>{won.label}</span>
  if (request.declined) return <span className="text-xs font-medium text-gray-400">Dijiste que no puedes</span>
  if (request.my_quotation != null) {
    return <span className="text-xs font-medium text-green-700">Cotizaste {soles(request.my_quotation)}</span>
  }
  return <span className="text-xs font-medium text-amber-600">Falta tu cotización</span>
}

export default function CarrierServiceRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    client.get('/api/carrier/service-requests')
      .then(({ data }) => setRequests(data.service_requests))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-gray-500 p-8">Cargando...</p>

  const today = todayInLima()
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Servicios</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Las solicitudes de tus servicios que todavía puedes cotizar, y las que ganaste. Ábrelas para ver
        los detalles y enviar o cambiar tu precio.
      </p>

      {failed && <p className="text-sm text-red-600">No se pudieron cargar las solicitudes. Recarga la página.</p>}
      {!failed && requests.length === 0 && (
        <div className="bg-white rounded-xl shadow p-6 text-sm text-gray-500">
          Todavía no hay solicitudes de tus servicios. Cuando llegue una te avisamos por correo y WhatsApp, y
          también aparecerá aquí.
        </div>
      )}

      <ul className="space-y-3">
        {requests.map((r) => {
          const past = r.preferred_date && r.preferred_date < today
          return (
            <li key={r.id} className="bg-white rounded-xl shadow p-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">
                  {r.service_type?.name || 'Servicio'} · #{r.id}
                </p>
                <p className="text-sm text-gray-600">
                  {[
                    r.neighborhood,
                    r.preferred_date ? shortDate(r.preferred_date) : 'Sin fecha',
                    r.items_count ? `${r.items_count} ${r.items_count === 1 ? 'cosa' : 'cosas'}` : null,
                  ].filter(Boolean).join(' · ')}
                  {past && <span className="ml-1 text-xs text-gray-400">(fecha pasada)</span>}
                </p>
                <div className="mt-1"><Status request={r} /></div>
              </div>
              <Link
                to={r.carrier_path}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
              >
                {r.quotation_state === 'open' && r.my_quotation == null && !r.declined ? 'Cotizar' : 'Ver'}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
