import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import client from '../../api/client'
import ServiceRequestView from '../../components/ServiceRequestView'

// Mismo número que usa la landing para cotizar por WhatsApp.
const CHALAN_WHATSAPP = '51972643007'

function Notice({ title, children }) {
  return (
    <div className="mx-auto max-w-md rounded-xl bg-white p-8 text-center shadow">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      <p className="mt-2 text-sm text-gray-500">{children}</p>
    </div>
  )
}

// Página pública: la abre un transportista con el link que le llegó por email o
// WhatsApp, sin cuenta. Por eso vive fuera del Layout y del ProtectedRoute.
export default function ServiceRequestCarrierView() {
  const { token } = useParams()
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    client.get(`/api/public/service-requests/${token}`)
      .then(({ data }) => setState({ status: 'ok', request: data.service_request }))
      .catch((err) => {
        const code = err.response?.status
        setState({ status: code === 410 ? 'expired' : code === 404 ? 'invalid' : 'error' })
      })
  }, [token])

  const request = state.request
  const quoteText = request
    ? `Cotización solicitud #${request.id} (${request.service_type?.name}): S/ `
    : ''

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      <header className="bg-gray-900 px-4 py-3">
        <span className="text-lg font-bold text-teal-400">Chalán</span>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        {state.status === 'loading' && <p className="py-16 text-center text-gray-400">Cargando…</p>}
        {state.status === 'invalid' && <Notice title="Link no válido">Revisa que hayas copiado el link completo, o pide uno nuevo a Chalán.</Notice>}
        {state.status === 'expired' && <Notice title="Este link venció">Pide uno nuevo a Chalán.</Notice>}
        {state.status === 'error' && <Notice title="No pudimos cargar la solicitud">Inténtalo de nuevo en unos minutos.</Notice>}
        {state.status === 'ok' && (
          <>
            {request.status === 'cancelled' && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                Esta solicitud fue cancelada: ya no hace falta cotizar.
              </div>
            )}
            <p className="mb-4 text-sm text-gray-500">
              Hola{request.carrier_company_name ? `, ${request.carrier_company_name}` : ''}. Esta es la solicitud para cotizar.
            </p>
            <ServiceRequestView request={request} />
          </>
        )}
      </main>
      {state.status === 'ok' && request.status !== 'cancelled' && (
        <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white p-3">
          <a
            href={`https://wa.me/${CHALAN_WHATSAPP}?text=${encodeURIComponent(quoteText)}`}
            target="_blank"
            rel="noreferrer"
            className="mx-auto block max-w-2xl rounded-lg bg-green-600 py-3 text-center font-semibold text-white hover:bg-green-700"
          >
            Enviar mi precio por WhatsApp
          </a>
        </div>
      )}
    </div>
  )
}
