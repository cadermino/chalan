import { useState } from 'react'

// Los códigos los valida el API principal (app/api/carrier_declines.py).
export const DECLINE_REASONS = [
  { code: 'date_unavailable', label: 'No tengo disponibilidad en esa fecha' },
  { code: 'zone', label: 'No trabajo en esa zona' },
  { code: 'vehicle', label: 'No tengo el vehículo o el equipo adecuado' },
  { code: 'budget', label: 'No me conviene por el precio' },
  { code: 'other', label: 'Otro motivo' },
]

export const declineReasonLabel = (code) =>
  DECLINE_REASONS.find(r => r.code === code)?.label || code

const MAX_NOTE = 500

const formatDate = (iso) => (iso
  ? new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', timeZone: 'America/Lima' })
  : '')

// El servidor responde {message} en inglés, pensado para quien programa.
function friendlyError(err) {
  if (!err.response) return 'No hay conexión. Revisa tu internet e inténtalo de nuevo.'
  const message = err.response.data?.message || ''
  if (message.includes('note is required')) return 'Cuéntanos el motivo en la nota.'
  if (message.includes('note')) return `La nota es muy larga (máximo ${MAX_NOTE} caracteres).`
  if (message.includes('reason')) return 'Elige un motivo.'
  if (message.includes('already selected')) return 'Tu cotización ya fue elegida: no se puede rechazar desde acá. Escríbenos para resolverlo.'
  if (message.includes('already assigned')) return 'Esta solicitud ya fue asignada a otro transportista.'
  if (message.includes('cancelled') || message.includes('not awaiting')) return 'Esta solicitud ya no está abierta.'
  if (err.response.status === 404 || err.response.status === 410) return 'Este link ya no es válido. Pide uno nuevo a Chalán.'
  return 'No pudimos guardar tu respuesta. Inténtalo de nuevo.'
}

/**
 * "No puedo hacer este trabajo": el transportista rechaza con un motivo, o deshace
 * un rechazo. Lo usan la página pública de solicitudes de servicio y el detalle
 * de la orden en el backoffice.
 *
 * - decline: el rechazo actual ({reason, note, updated_date}) o null.
 * - quotedAmount: texto del monto vivo del transportista, para avisar que se retira.
 * - onDecline({reason, note}) / onUndo(): promesas; el padre recarga después.
 * - onConflict(): opcional, se llama ante un 409 para que el padre recargue el estado.
 */
export default function DeclinePanel({ decline, quotedAmount, onDecline, onUndo, onConflict }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const run = async (action) => {
    setError('')
    setSaving(true)
    try {
      await action()
      setOpen(false)
      setReason('')
      setNote('')
    } catch (err) {
      setError(friendlyError(err))
      if (err.response?.status === 409 && onConflict) await onConflict()
    } finally {
      setSaving(false)
    }
  }

  if (decline) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow">
        <h2 className="text-base font-semibold text-gray-900">Rechazaste esta solicitud</h2>
        <p className="mt-1 text-sm text-gray-600">
          {declineReasonLabel(decline.reason)}
          {decline.note ? ` — “${decline.note}”` : ''}
          {decline.updated_date ? ` · ${formatDate(decline.updated_date)}` : ''}
        </p>
        {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button
          type="button"
          disabled={saving}
          onClick={() => run(onUndo)}
          className="mt-4 rounded-lg border border-teal-600 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Cambié de opinión, quiero cotizar'}
        </button>
      </section>
    )
  }

  if (!open) {
    return (
      <p className="text-center text-sm">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-gray-500 underline hover:text-gray-700"
        >
          No puedo hacer este trabajo
        </button>
      </p>
    )
  }

  const submit = (e) => {
    e.preventDefault()
    if (!reason) { setError('Elige un motivo.'); return }
    if (reason === 'other' && !note.trim()) { setError('Cuéntanos el motivo en la nota.'); return }
    run(() => onDecline({ reason, note: note.trim() || null }))
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow">
      <h2 className="text-base font-semibold text-gray-900">¿Por qué no puedes hacerlo?</h2>
      <p className="mt-1 text-sm text-gray-500">
        Así sabemos qué trabajos mandarte.
        {quotedAmount ? ` Tu cotización de ${quotedAmount} se retirará.` : ''}
      </p>
      <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
        <fieldset className="space-y-2">
          <legend className="sr-only">Motivo</legend>
          {DECLINE_REASONS.map(r => (
            <label key={r.code} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="decline-reason"
                value={r.code}
                checked={reason === r.code}
                onChange={() => { setReason(r.code); setError('') }}
                className="text-teal-600 focus:ring-teal-500"
              />
              {r.label}
            </label>
          ))}
        </fieldset>
        <div>
          <label htmlFor="decline-note" className="mb-1 block text-sm font-medium text-gray-700">
            Nota{' '}
            <span className="font-normal text-gray-400">{reason === 'other' ? '(obligatoria)' : '(opcional)'}</span>
          </label>
          <textarea
            id="decline-note"
            rows={2}
            maxLength={MAX_NOTE}
            value={note}
            onChange={(e) => { setNote(e.target.value); setError('') }}
            className="input"
          />
        </div>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Confirmar rechazo'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => { setOpen(false); setError('') }}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Volver
          </button>
        </div>
      </form>
    </section>
  )
}

// Para el admin: quién dijo que no y por qué. Sirve para no volver a insistirle.
export function DeclinesList({ declines }) {
  if (!declines?.length) return null
  return (
    <div className="bg-white rounded-xl shadow p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Rechazaron ({declines.length})</h2>
      <ul className="divide-y divide-gray-100">
        {declines.map(d => (
          <li key={d.carrier_company_id} className="py-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="font-medium text-gray-900">{d.carrier_company_name || `Empresa #${d.carrier_company_id}`}</span>
              <span className="text-xs text-gray-400 shrink-0">{formatDate(d.updated_date)}</span>
            </div>
            <p className="text-gray-600">
              {declineReasonLabel(d.reason)}
              {d.note ? <span className="text-gray-500"> — “{d.note}”</span> : null}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
