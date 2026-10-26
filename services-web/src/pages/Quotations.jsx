import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { chooseQuotation, getQuotations } from '../api'
import { tagSession, track } from '../analytics'
import ConfirmModal, { money } from '../components/ConfirmModal'
import { COPY, SERVICE, paintingFacts, whatsappUrl, workLabel } from '../config'
import { formatDateLabel } from '../dates'

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1)

function itemLabel(item) {
  const extras = [item.work && workLabel(item.work), item.pack && 'embalado'].filter(Boolean)
  return `${item.quantity} × ${item.description}${extras.length ? ` — ${extras.join(' · ')}` : ''}`
}

function QuotationCard({ quotation, lowest, canChoose, onChoose }) {
  return (
    <li className={`rounded-xl border p-4 ${quotation.selected ? 'border-accent bg-accentSoft' : 'border-line bg-paper2'}`}>
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
      {canChoose && (
        <button type="button" className="btn-secondary mt-3 w-full" onClick={onChoose}>
          Elegir esta
        </button>
      )}
    </li>
  )
}

// Cómo quedó la elegida: esperando que Chalán encuentre el yapeo, o agendada.
function SelectedStatus({ selected, reservation, contact, date, onCorrect }) {
  if (reservation?.status === 'pending') {
    return (
      <div role="status" className="mt-6 rounded-lg border border-line bg-paper2 p-4 text-sm">
        <p className="font-semibold text-inkStrong">Estamos verificando tu yapeo</p>
        <p className="mt-1 text-inkSoft">
          Elegiste a {selected.carrier_name}. Recibimos tu número de operación {reservation.reference} por{' '}
          {money(reservation.amount)}. Cuando lo confirmemos te avisamos por WhatsApp y {selected.carrier_name} recibe
          el pedido.
        </p>
        <button type="button" className="mt-2 text-sm text-accent underline" onClick={onCorrect}>
          ¿Te equivocaste de número? Corrígelo
        </button>
      </div>
    )
  }
  return (
    <div role="status" className="mt-6 rounded-lg border border-accent bg-accentSoft p-4 text-sm">
      <p className="font-semibold text-inkStrong">
        ¡Listo! Tu servicio con {selected.carrier_name} quedó agendado{date ? ` para el ${date}` : ''}.
      </p>
      <p className="mt-1 text-inkSoft">
        {reservation?.status === 'paid'
          ? `Ya yapeaste ${money(reservation.amount)}. ${capitalize(COPY.payDay)} le pagas ${money(selected.on_site_amount)} a ${selected.carrier_name}.`
          : `Le pagas ${money(selected.total_amount)} a ${selected.carrier_name} ${COPY.payDay}.`}
        {contact?.phone
          ? ` Coordina la hora directo con ${contact.name}.`
          : ' Te escribimos por WhatsApp para coordinar la hora.'}
      </p>
      {contact?.phone && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-inkStrong">WhatsApp de {contact.name}: <span className="font-semibold">{contact.phone}</span></p>
          {contact.whatsapp_url && (
            <a className="btn-primary" href={contact.whatsapp_url} target="_blank" rel="noopener noreferrer">
              Escribirle por WhatsApp
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export default function Quotations() {
  const { publicId } = useParams()
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  // { quotation, correcting } mientras el modal está abierto.
  const [modal, setModal] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoadError('')
    return getQuotations(publicId)
      .then((body) => {
        tagSession('service_request_id', body.id)
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

  // Lo llama el modal; si falla por el número, el modal muestra el error y sigue abierto.
  const confirm = async (operationNumber) => {
    try {
      await chooseQuotation(publicId, modal.quotation.id, operationNumber)
    } catch (err) {
      const reason = err?.response?.data?.message
      if (err?.response?.status !== 409 || reason === 'operation_number_already_used') throw err
      // Ya hay otra elegida (la eligió Chalán) o la solicitud se canceló: se muestra cómo quedó.
      setModal(null)
      setError('Esta solicitud ya no se puede elegir desde aquí. Mira cómo quedó o escríbenos.')
      await load()
      return
    }
    if (!modal.correcting) {
      track('service_quotation_chosen', {
        service: SERVICE,
        payment_method: operationNumber ? 'yape_reservation' : 'cash',
        value: modal.quotation.total_amount,
        currency: 'PEN',
      })
    }
    setModal(null)
    setError('')
    await load()
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

  const { quotations, reservation } = data
  const selected = quotations.find((q) => q.selected)
  const cancelled = data.status === 'cancelled'
  const canChoose = !selected && !cancelled
  const lowestTotal = quotations.length > 1 ? Math.min(...quotations.map((q) => q.total_amount)) : null
  const date = data.preferred_date && formatDateLabel(data.preferred_date)
  const summary = [data.service_type.name, data.neighborhood, date].filter(Boolean).join(' · ')
  const whatsappText = selected
    ? `Hola, elegí a ${selected.carrier_name} para mi solicitud de ${data.service_type.name.toLowerCase()}`
    : COPY.whatsappSent

  return (
    <>
      <h1 className="text-2xl font-semibold text-inkStrong">Tus cotizaciones</h1>
      <p className="mt-1 text-inkSoft">{summary}</p>

      {SERVICE === 'painting' ? (
        <details className="mt-4 rounded-lg border border-line p-3 text-sm">
          <summary className="cursor-pointer text-inkSoft">{COPY.itemsSummary}</summary>
          <p className="mt-2 whitespace-pre-line text-ink">{data.details?.description || 'Lo explicaste en el video.'}</p>
          {paintingFacts(data.details) && <p className="mt-1 text-mute">{paintingFacts(data.details)}</p>}
        </details>
      ) : (
        <details className="mt-4 rounded-lg border border-line p-3 text-sm">
          <summary className="cursor-pointer text-inkSoft">{COPY.itemsSummary} ({data.items.length})</summary>
          <ul className="mt-2 space-y-1 text-ink">
            {data.items.map((item, index) => <li key={index}>{itemLabel(item)}</li>)}
          </ul>
        </details>
      )}

      {cancelled && (
        <div role="status" className="mt-6 rounded-lg border border-line bg-paper2 p-4 text-sm text-inkStrong">
          Esta solicitud fue cancelada. Si todavía necesitas el servicio, escríbenos.
        </div>
      )}

      {selected && !cancelled && (
        <SelectedStatus
          selected={selected}
          reservation={reservation}
          contact={data.carrier_contact}
          date={date}
          onCorrect={() => setModal({ quotation: selected, correcting: true })}
        />
      )}

      {canChoose && reservation?.status === 'cancelled' && (
        <div role="alert" className="mt-6 rounded-lg border border-danger p-4 text-sm">
          <p className="font-semibold text-inkStrong">No encontramos tu yapeo</p>
          <p className="mt-1 text-inkSoft">
            No llegó el yapeo de {money(reservation.amount)} con la operación {reservation.reference}. Vuelve a elegir y
            revisa el número, o escríbenos.
          </p>
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
                onChoose={() => { setError(''); setModal({ quotation: q, correcting: false }) }}
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

      {modal && (
        <ConfirmModal
          quotation={modal.quotation}
          summary={summary}
          reservationRequired={data.reservation_required}
          correcting={modal.correcting}
          onConfirm={confirm}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
