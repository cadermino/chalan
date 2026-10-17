import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { chooseQuotation, getQuotations } from '../api'
import { track } from '../analytics'
import { COPY, SERVICE, whatsappUrl, workLabel } from '../config'
import { formatDateLabel } from '../dates'

const money = (value) =>
  `S/ ${Number(value).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function itemLabel(item) {
  const extras = [item.work && workLabel(item.work), item.pack && 'embalado'].filter(Boolean)
  return `${item.quantity} × ${item.description}${extras.length ? ` — ${extras.join(' · ')}` : ''}`
}

function QuotationCard({ quotation, lowest, canChoose, confirming, busy, onAsk, onChoose }) {
  return (
    <li
      className={`rounded-xl border p-4 ${quotation.selected ? 'border-accent bg-accentSoft' : 'border-line bg-paper2'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-inkStrong">
            {quotation.carrier_name}
            {quotation.selected && (
              <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">Elegida</span>
            )}
            {!quotation.selected && lowest && (
              <span className="ml-2 rounded-full border border-accent px-2 py-0.5 text-xs text-accent">Más barata</span>
            )}
          </p>
          {quotation.note && <p className="mt-1 text-sm text-inkSoft">“{quotation.note}”</p>}
        </div>
        <p className="shrink-0 text-xl font-semibold text-inkStrong">{money(quotation.total_amount)}</p>
      </div>

      {canChoose && !confirming && (
        <button type="button" className="btn-secondary mt-3 w-full" disabled={busy} onClick={() => onAsk()}>
          Elegir esta
        </button>
      )}
      {canChoose && confirming && (
        <div className="mt-3 rounded-lg border border-line bg-paper p-3">
          <p className="text-sm text-inkStrong">
            ¿Eliges a {quotation.carrier_name} por {money(quotation.total_amount)}? Después ya no se puede cambiar desde aquí.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-primary flex-1" disabled={busy} onClick={onChoose}>
              {busy ? 'Eligiendo…' : 'Sí, elegir'}
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => onAsk(null)}>
              No
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

export default function Quotations() {
  const { publicId } = useParams()
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [confirmingId, setConfirmingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoadError('')
    return getQuotations(publicId)
      .then((body) => {
        setData(body)
        return body
      })
      .catch((err) => {
        setLoadError(err?.response?.status === 404 ? 'not_found' : 'network')
      })
  }, [publicId])

  useEffect(() => {
    load().then((body) => {
      if (body) track('service_quotations_view', { service: SERVICE, quotations: body.quotations.length })
    })
  }, [load])

  const choose = async (quotation) => {
    setBusy(true)
    setError('')
    try {
      await chooseQuotation(publicId, quotation.id)
      track('service_quotation_chosen', { service: SERVICE })
      setConfirmingId(null)
      await load()
    } catch (err) {
      if (err?.response?.status === 409) {
        // Otra ya quedó elegida (la eligió Chalán, o la solicitud se canceló): se muestra cómo quedó.
        setError('Esta solicitud ya no se puede elegir desde aquí. Mira cómo quedó o escríbenos.')
        setConfirmingId(null)
        await load()
      } else {
        setError(err?.response ? 'No pudimos elegirla. Inténtalo de nuevo.' : 'No hay conexión. Revisa tu internet e inténtalo de nuevo.')
      }
    } finally {
      setBusy(false)
    }
  }

  if (loadError === 'not_found') {
    return (
      <div className="py-10 text-center">
        <h1 className="text-2xl font-semibold text-inkStrong">No encontramos esta solicitud</h1>
        <p className="mx-auto mt-2 max-w-sm text-inkSoft">Revisa que el link esté completo, o escríbenos y te ayudamos.</p>
        <a className="btn-primary mt-8" href={whatsappUrl(COPY.whatsappSent)} target="_blank" rel="noopener noreferrer">
          Escríbenos por WhatsApp
        </a>
      </div>
    )
  }
  if (loadError) {
    return (
      <div role="alert" className="mt-6 rounded-lg border border-line bg-paper2 p-4 text-sm">
        <p className="text-inkStrong">No pudimos cargar tus cotizaciones. Revisa tu conexión.</p>
        <button type="button" className="btn-secondary mt-3" onClick={load}>Reintentar</button>
      </div>
    )
  }
  if (!data) return <p className="py-16 text-center text-inkSoft">Cargando…</p>

  const { quotations } = data
  const selected = quotations.find((q) => q.selected)
  const cancelled = data.status === 'cancelled'
  const canChoose = !selected && !cancelled
  const lowestTotal = quotations.length > 1 ? Math.min(...quotations.map((q) => q.total_amount)) : null
  const where = [data.neighborhood, data.preferred_date && formatDateLabel(data.preferred_date)].filter(Boolean).join(' · ')
  const whatsappText = selected
    ? `Hola, elegí a ${selected.carrier_name} para mi solicitud de ${data.service_type.name.toLowerCase()}`
    : COPY.whatsappSent

  return (
    <>
      <h1 className="text-2xl font-semibold text-inkStrong">Tus cotizaciones</h1>
      <p className="mt-1 text-inkSoft">
        {data.service_type.name}{where ? ` · ${where}` : ''}
      </p>

      <details className="mt-4 rounded-lg border border-line p-3 text-sm">
        <summary className="cursor-pointer text-inkSoft">{COPY.itemsSummary} ({data.items.length})</summary>
        <ul className="mt-2 space-y-1 text-ink">
          {data.items.map((item, index) => <li key={index}>{itemLabel(item)}</li>)}
        </ul>
      </details>

      {cancelled && (
        <div role="status" className="mt-6 rounded-lg border border-line bg-paper2 p-4 text-sm text-inkStrong">
          Esta solicitud fue cancelada. Si todavía necesitas el servicio, escríbenos.
        </div>
      )}

      {selected && (
        <div role="status" className="mt-6 rounded-lg border border-accent bg-accentSoft p-4 text-sm">
          <p className="font-semibold text-inkStrong">
            Elegiste a {selected.carrier_name} por {money(selected.total_amount)}.
          </p>
          <p className="mt-1 text-inkSoft">Te escribimos por WhatsApp para coordinar el día y la hora.</p>
        </div>
      )}

      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}

      {quotations.length === 0 && !cancelled && (
        <div className="mt-6 rounded-lg border border-line bg-paper2 p-4 text-sm">
          <p className="text-inkStrong">Todavía no llegan cotizaciones.</p>
          <p className="mt-1 text-inkSoft">
            Te avisamos por WhatsApp cuando llegue la primera. Las siguientes van apareciendo aquí.
          </p>
          <button type="button" className="btn-secondary mt-3" onClick={load}>Actualizar</button>
        </div>
      )}

      {quotations.length > 0 && (
        <>
          <ul className="mt-6 space-y-3">
            {quotations.map((q) => (
              <QuotationCard
                key={q.id}
                quotation={q}
                lowest={q.total_amount === lowestTotal}
                canChoose={canChoose}
                confirming={confirmingId === q.id}
                busy={busy}
                onAsk={(id = q.id) => { setError(''); setConfirmingId(id) }}
                onChoose={() => choose(q)}
              />
            ))}
          </ul>
          <p className="mt-3 text-xs text-mute">
            Precios finales del servicio. {canChoose && 'Pueden llegar más: vuelve a abrir este link para verlas.'}
          </p>
        </>
      )}

      <p className="mt-8 text-center">
        <a className="btn-secondary" href={whatsappUrl(whatsappText)} target="_blank" rel="noopener noreferrer">
          ¿Dudas? Escríbenos por WhatsApp
        </a>
      </p>
    </>
  )
}
