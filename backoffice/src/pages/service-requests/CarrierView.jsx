import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import client from '../../api/client'
import ServiceRequestView, { formatMoney, formatTimestamp } from '../../components/ServiceRequestView'

// Mismo número que usa la landing; ahora solo para dudas, ya no para cotizar.
const CHALAN_WHATSAPP = '51972643007'
const MAX_AMOUNT = 100000
const MAX_NOTE = 500

function Notice({ title, children }) {
  return (
    <div className="mx-auto max-w-md rounded-xl bg-white p-8 text-center shadow">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      <p className="mt-2 text-sm text-gray-500">{children}</p>
    </div>
  )
}

// Acepta "350", "350.5", "350,50" (así se escribe en Perú), con o sin espacios.
// Devuelve el monto como texto con punto, o null si no sirve. El servidor vuelve a
// validar: esto solo ahorra un viaje.
function normalizeAmount(text) {
  const cleaned = text.replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const value = Number(cleaned)
  return value > 0 && value <= MAX_AMOUNT ? cleaned : null
}

// El servidor responde {message} en inglés, pensado para quien programa.
function friendlyError(err) {
  if (!err.response) return 'No hay conexión. Revisa tu internet e inténtalo de nuevo.'
  const message = err.response.data?.message || ''
  if (message.includes('amount')) return `Escribe un monto válido: mayor que 0 y hasta S/ ${MAX_AMOUNT.toLocaleString('es-PE')}.`
  if (message.includes('note')) return `La nota es muy larga (máximo ${MAX_NOTE} caracteres).`
  if (message.includes('already assigned')) return 'Esta solicitud ya fue asignada a otro transportista.'
  if (message.includes('already selected')) return 'Tu cotización ya fue elegida: no se puede cambiar. Escríbenos si necesitas un ajuste.'
  if (message.includes('cancelled')) return 'Esta solicitud fue cancelada: ya no hace falta cotizar.'
  if (err.response.status === 404 || err.response.status === 410) return 'Este link ya no es válido. Pide uno nuevo a Chalán.'
  return 'No pudimos enviar tu cotización. Inténtalo de nuevo.'
}

function QuotationForm({ token, request, onSaved }) {
  const mine = request.my_quotation
  const [amount, setAmount] = useState(mine ? String(mine.amount) : '')
  const [note, setNote] = useState(mine?.note || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(null) // {amount, at} de lo último que se envió en esta visita

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSent(null)
    const normalized = normalizeAmount(amount)
    if (!normalized) {
      setError(`Escribe un monto válido: mayor que 0 y hasta S/ ${MAX_AMOUNT.toLocaleString('es-PE')}.`)
      return
    }
    setSaving(true)
    try {
      const { data } = await client.post(`/api/public/service-requests/${token}/quotation`, {
        amount: normalized,
        note: note.trim() || null,
      })
      setSent({ amount: data.amount, at: new Date().toISOString() })
      await onSaved()
    } catch (err) {
      setError(friendlyError(err))
      // Un 409 cambia lo que se puede hacer (ya la asignaron, la cancelaron): se
      // vuelve a leer para que la página muestre el estado real.
      if (err.response?.status === 409) await onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <section id="cotizar" className="rounded-xl bg-white p-5 shadow">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">Tu cotización</h2>
      <p className="mb-4 text-sm text-gray-500">
        {mine
          ? `Ya enviaste ${formatMoney(mine.amount)}. Puedes corregirla hasta que Chalán elija una cotización.`
          : 'Escribe cuánto cobrarías por este trabajo. Chalán te avisa si te eligen.'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="quotation-amount" className="mb-1 block text-sm font-medium text-gray-700">
            Monto <span className="text-red-500">*</span>
          </label>
          <div className="flex">
            <span className="flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 text-gray-500">S/</span>
            <input
              id="quotation-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="350.00"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError('') }}
              className="input !rounded-l-none text-lg"
              aria-invalid={Boolean(error)}
            />
          </div>
        </div>

        <div>
          <label htmlFor="quotation-note" className="mb-1 block text-sm font-medium text-gray-700">
            Nota <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <textarea
            id="quotation-note"
            rows={3}
            maxLength={MAX_NOTE}
            placeholder="Ej. Incluye materiales, vamos 2 personas, demora 3 horas"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input"
          />
          <p className="mt-1 text-right text-xs text-gray-400">{note.length}/{MAX_NOTE}</p>
        </div>

        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {sent && (
          <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            Cotización enviada: {formatMoney(sent.amount)}. Te avisaremos si te eligen.
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-teal-600 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {saving ? 'Enviando…' : mine ? 'Actualizar cotización' : 'Enviar cotización'}
        </button>
        {mine && !sent && (
          <p className="text-center text-xs text-gray-400">Última actualización: {formatTimestamp(mine.updated_date)}</p>
        )}
      </form>

      <p className="mt-4 text-center text-sm text-gray-500">
        ¿Dudas?{' '}
        <a
          className="text-teal-600 hover:underline"
          href={`https://wa.me/${CHALAN_WHATSAPP}?text=${encodeURIComponent(`Hola, tengo una duda sobre la solicitud #${request.id}`)}`}
          target="_blank"
          rel="noreferrer"
        >
          Escríbenos por WhatsApp
        </a>
      </p>
    </section>
  )
}

// Lo que ve el transportista cuando ya no puede cotizar.
function Outcome({ state, request }) {
  if (state === 'selected_mine') {
    return (
      <section className="rounded-xl border border-green-200 bg-green-50 p-5 text-green-900">
        <h2 className="text-lg font-semibold">¡Te eligieron!</h2>
        <p className="mt-1 text-sm">
          Tu cotización de {formatMoney(request.my_quotation?.amount)} fue la elegida. Chalán te contactará para coordinar.
        </p>
      </section>
    )
  }
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 text-gray-700 shadow">
      <h2 className="text-lg font-semibold">Solicitud asignada</h2>
      <p className="mt-1 text-sm">Esta solicitud ya fue asignada a otro transportista. Gracias por cotizar.</p>
    </section>
  )
}

// Página pública: la abre un transportista con el link que le llegó por email o
// WhatsApp, sin cuenta. Por eso vive fuera del Layout y del ProtectedRoute.
export default function ServiceRequestCarrierView() {
  const { token } = useParams()
  const [state, setState] = useState({ status: 'loading' })

  const load = useCallback(() =>
    client.get(`/api/public/service-requests/${token}`)
      .then(({ data }) => setState({ status: 'ok', request: data.service_request }))
      .catch((err) => {
        const code = err.response?.status
        setState({ status: code === 410 ? 'expired' : code === 404 ? 'invalid' : 'error' })
      }), [token])

  useEffect(() => { load() }, [load])

  const request = state.request
  const quotationState = request?.quotation_state
  const canQuote = state.status === 'ok' && quotationState === 'open'

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      <header className="bg-gray-900 px-4 py-3">
        <span className="text-lg font-bold text-teal-400">Chalán</span>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        {state.status === 'loading' && <p className="py-16 text-center text-gray-400">Cargando…</p>}
        {state.status === 'invalid' && <Notice title="Link no válido">Revisa que hayas copiado el link completo, o pide uno nuevo a Chalán.</Notice>}
        {state.status === 'expired' && <Notice title="Este link venció">Pide uno nuevo a Chalán.</Notice>}
        {state.status === 'error' && <Notice title="No pudimos cargar la solicitud">Inténtalo de nuevo en unos minutos.</Notice>}
        {state.status === 'ok' && (
          <>
            {quotationState === 'cancelled' && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                Esta solicitud fue cancelada: ya no hace falta cotizar.
              </div>
            )}
            <p className="text-sm text-gray-500">
              Hola{request.carrier_company_name ? `, ${request.carrier_company_name}` : ''}. Esta es la solicitud para cotizar.
            </p>
            <ServiceRequestView request={request} />
            {quotationState === 'open' && <QuotationForm token={token} request={request} onSaved={load} />}
            {(quotationState === 'selected_mine' || quotationState === 'selected_other') && (
              <Outcome state={quotationState} request={request} />
            )}
          </>
        )}
      </main>

      {/* En el celular el formulario queda al final de una página larga: el botón fijo lleva hasta él. */}
      {canQuote && (
        <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white p-3">
          <a
            href="#cotizar"
            className="mx-auto block max-w-2xl rounded-lg bg-teal-600 py-3 text-center font-semibold text-white hover:bg-teal-700"
          >
            {request.my_quotation ? 'Ver o actualizar mi cotización' : 'Enviar mi cotización'}
          </a>
        </div>
      )}
    </div>
  )
}
