import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import StepNav from '../../components/StepNav'
import StepTracker from '../../components/StepTracker'
import { friendlyError, getMaterials } from '../../api'
import { track } from '../../analytics'
import { PATHS, SERVICE } from '../../config'
import { useRequest } from '../../context/RequestContext'
import { MAX_ADVANCE_DAYS, dateLimits, formatDateLabel, isValidPreferredDate } from '../../dates'

// Acepta lo que la gente pega: "987 654 321", "+51 987654321", "51987654321".
function nineDigits(raw) {
  let digits = raw.replace(/\D/g, '')
  if (digits.length > 9 && digits.startsWith('51')) digits = digits.slice(2)
  return digits.slice(0, 9)
}

function SummaryRow({ title, editTo, children }) {
  return (
    <div className="border-t border-line py-3 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-inkStrong">{title}</h3>
        <Link to={editTo} className="text-sm text-accent underline">Editar</Link>
      </div>
      <div className="mt-1 text-sm text-inkSoft">{children}</div>
    </div>
  )
}

export default function ContactStep() {
  const { draft, setPreferredDate, setWhatsapp, submit } = useRequest()
  const navigate = useNavigate()
  const [materialNames, setMaterialNames] = useState({})
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [sending, setSending] = useState(false)
  const { min, max } = dateLimits()

  useEffect(() => {
    track('service_request_step_view', { service: SERVICE, step: 'contact' })
    // Solo para mostrar nombres en el resumen; si falla se muestran los codes.
    getMaterials(SERVICE)
      .then((list) => setMaterialNames(Object.fromEntries(list.map((m) => [m.code, m.name]))))
      .catch(() => {})
  }, [])

  const handleSubmit = async () => {
    const found = {}
    if (!isValidPreferredDate(draft.preferredDate)) {
      found.date = `Elige un día desde mañana y hasta dentro de ${MAX_ADVANCE_DAYS} días.`
    }
    if (!/^9\d{8}$/.test(draft.whatsapp)) {
      found.whatsapp = 'Escribe tu número de 9 dígitos, empieza con 9.'
    }
    setErrors(found)
    setSubmitError('')
    if (Object.keys(found).length > 0) return

    setSending(true)
    try {
      await submit({ whatsapp: draft.whatsapp, preferredDate: draft.preferredDate })
      navigate(PATHS.sent, { replace: true })
    } catch (err) {
      setSubmitError(friendlyError(err, 'No pudimos enviar tu solicitud. Inténtalo de nuevo.'))
      setSending(false)
    }
  }

  const { address } = draft

  return (
    <>
      <StepTracker current={3} />
      <h1 className="text-2xl font-semibold text-inkStrong">¿Cuándo lo necesitas?</h1>
      <p className="mt-1 text-inkSoft">Con esto los transportistas pueden cotizarte.</p>

      <div className="mt-6 space-y-5">
        <div>
          <label htmlFor="preferred-date" className="mb-1 block text-sm font-semibold text-inkStrong">
            Fecha deseada <span className="text-danger">*</span>
          </label>
          <input
            id="preferred-date"
            type="date"
            className={`field ${errors.date ? 'border-danger' : ''}`}
            min={min}
            max={max}
            value={draft.preferredDate}
            onChange={(event) => { setErrors((e) => ({ ...e, date: '' })); setPreferredDate(event.target.value) }}
          />
          {draft.preferredDate && !errors.date && (
            <p className="mt-1 text-sm text-accent first-letter:uppercase">{formatDateLabel(draft.preferredDate)}</p>
          )}
          <p className="mt-1 text-xs text-mute">
            Para una casa completa te recomendamos pedirlo con 2–3 días de anticipación.
          </p>
          {errors.date && <p role="alert" className="mt-1 text-sm text-danger">{errors.date}</p>}
        </div>

        <div>
          <label htmlFor="whatsapp" className="mb-1 block text-sm font-semibold text-inkStrong">
            Tu WhatsApp <span className="text-danger">*</span>
          </label>
          <div className="flex">
            <span className="flex items-center rounded-l-lg border border-r-0 border-line bg-paper px-3 text-inkSoft">+51</span>
            <input
              id="whatsapp"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              className={`field rounded-l-none ${errors.whatsapp ? 'border-danger' : ''}`}
              placeholder="987 654 321"
              value={draft.whatsapp}
              onChange={(event) => { setErrors((e) => ({ ...e, whatsapp: '' })); setWhatsapp(nineDigits(event.target.value)) }}
            />
          </div>
          <p className="mt-1 text-xs text-mute">Te escribiremos por aquí con las cotizaciones.</p>
          {errors.whatsapp && <p role="alert" className="mt-1 text-sm text-danger">{errors.whatsapp}</p>}
        </div>
      </div>

      <h2 className="mb-1 mt-8 text-lg font-semibold text-inkStrong">Revisa tu solicitud</h2>
      <div className="rounded-xl border border-line bg-paper2 px-4">
        <SummaryRow title="Dirección" editTo={PATHS.address}>
          {address.street}{address.interior ? ` · ${address.interior}` : ''}
        </SummaryRow>
        <SummaryRow title={`Qué embalamos (${draft.items.length})`} editTo={PATHS.items}>
          <ul className="space-y-1">
            {draft.items.map((item) => (
              <li key={item.key}>
                {item.quantity} × {item.description}
                {item.materials.length > 0 && (
                  <span className="text-mute"> — {item.materials.map((c) => materialNames[c] || c).join(', ')}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-mute">
            {draft.media.length === 0 ? 'Sin fotos ni videos' : `${draft.media.length} foto(s) o video(s)`}
          </p>
        </SummaryRow>
      </div>

      {submitError && <p role="alert" className="mt-4 text-sm text-danger">{submitError}</p>}

      <StepNav
        onBack={() => navigate(PATHS.items)}
        nextLabel="Enviar solicitud"
        onNext={handleSubmit}
        loading={sending}
      />
    </>
  )
}
