import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MediaUploader from '../../components/MediaUploader'
import StepNav from '../../components/StepNav'
import StepTracker from '../../components/StepTracker'
import { Chip, Question } from '../../components/Choices'
import { friendlyError } from '../../api'
import { saveFailure, track, trackBlocked } from '../../analytics'
import { COPY, PAINTING_AREAS, PAINTING_PAINT_BY, PAINTING_SIZES, PAINTING_WALL_ISSUES, PATHS, SERVICE } from '../../config'
import { useRequest } from '../../context/RequestContext'

const DESCRIPTION_MAX = 2000

export default function DetailsStep() {
  const { draft, saveDetails, addMedia, removeMedia } = useRequest()
  const navigate = useNavigate()
  const [details, setDetails] = useState({
    description: '', area: null, size: null, paint_by: null, wall_issues: [], ...draft.details,
  })
  const [m2, setM2] = useState(draft.details.area_m2 ? String(draft.details.area_m2) : '')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [m2Error, setM2Error] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    track('service_request_step_view', { service: SERVICE, step: 'items' })
  }, [])

  const set = (fields) => { setError(''); setDetails((current) => ({ ...current, ...fields })) }
  const pick = (key, code) => set({ [key]: details[key] === code ? null : code })
  const toggleIssue = (code) => set({
    wall_issues: details.wall_issues.includes(code)
      ? details.wall_issues.filter((c) => c !== code)
      : [...details.wall_issues, code],
  })

  const hasVideo = draft.media.some((m) => m.media_type === 'video')

  const handleNext = async () => {
    // Un video donde lo cuenta hablando reemplaza al texto; sin ninguno de los dos
    // el pintor no sabe qué cotizar.
    if (!details.description.trim() && !hasVideo) {
      trackBlocked(SERVICE, 'items', 'description')
      setError(COPY.emptyItems)
      return
    }
    const area = Number(m2)
    // Se cotiza por m²: sin ellos las cotizaciones no se pueden comparar.
    if (!Number.isInteger(area) || area <= 0) {
      trackBlocked(SERVICE, 'items', 'area_m2')
      setM2Error('Pon los metros cuadrados, aunque sean aproximados.')
      return
    }
    setSaving(true)
    try {
      await saveDetails({
        description: details.description,
        area: details.area,
        size: details.size,
        paint_by: details.paint_by,
        wall_issues: details.wall_issues,
        area_m2: Number.isInteger(area) && area > 0 ? area : null,
      })
      navigate(PATHS.contact)
    } catch (err) {
      trackBlocked(SERVICE, 'items', saveFailure(err))
      setError(friendlyError(err, 'No pudimos guardar lo que contaste. Inténtalo de nuevo.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <StepTracker current={2} />
      <h1 className="text-2xl font-semibold text-inkStrong">¿Qué quieres pintar?</h1>
      <p className="mt-1 text-inkSoft">
        Escríbelo o mándanos un video recorriendo las paredes y contándolo. Con eso los pintores te cotizan.
      </p>

      <div className="mt-6">
        <label htmlFor="painting-description" className="mb-1 block text-sm font-semibold text-inkStrong">
          Cuéntanos qué hay que pintar {!hasVideo && <span className="text-danger">*</span>}
        </label>
        <textarea
          id="painting-description"
          rows={5}
          maxLength={DESCRIPTION_MAX}
          className={`field ${error ? 'border-danger' : ''}`}
          placeholder="Ej: la sala, el comedor y 2 dormitorios, paredes y techo. Color blanco humo. Hay una pared con humedad."
          value={details.description}
          onChange={(event) => set({ description: event.target.value })}
        />
        <p className="mt-1 text-xs text-mute">
          {hasVideo
            ? 'Ya subiste un video: el texto es opcional.'
            : 'Si subes un video explicándolo, no hace falta escribir.'}
        </p>
      </div>

      <div className="mt-6">
        <label htmlFor="painting-m2" className="mb-1 block text-sm font-semibold text-inkStrong">
          Metros cuadrados de pared <span className="text-danger">*</span>
        </label>
        <input
          id="painting-m2"
          type="number"
          inputMode="numeric"
          min="1"
          max="5000"
          className={`field w-40 ${m2Error ? 'border-danger' : ''}`}
          placeholder="Ej. 60"
          value={m2}
          onChange={(event) => { setM2Error(''); setM2(event.target.value.replace(/\D/g, '').slice(0, 4)) }}
        />
        <p className="mt-1 text-xs text-mute">
          Aproximado está bien: suma el largo de las paredes y multiplícalo por el alto (unos 2,40 m). Si también es el techo, súmalo.
        </p>
        {m2Error && <p role="alert" className="mt-1 text-sm text-danger">{m2Error}</p>}
      </div>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-inkStrong">Fotos o videos</h2>
      <MediaUploader
        publicId={draft.publicId}
        media={draft.media}
        onAdded={(media) => { setError(''); addMedia(media) }}
        onRemoved={removeMedia}
        onBusyChange={setUploading}
      />
      <p className="mt-2 text-xs text-mute">Un video corto recorriendo los ambientes ayuda mucho a cotizar bien.</p>

      <h2 className="mb-1 mt-8 text-lg font-semibold text-inkStrong">Si lo sabes</h2>
      <p className="mb-4 text-sm text-inkSoft">Todo opcional, pero ayuda a que te coticen más parecido.</p>
      <div className="space-y-5">
        <Question title="¿Dónde?">
          {PAINTING_AREAS.map((o) => (
            <Chip key={o.code} name="area" checked={details.area === o.code} onToggle={() => pick('area', o.code)}>
              {o.label}
            </Chip>
          ))}
        </Question>
        <Question title="¿Más o menos cuánto?">
          {PAINTING_SIZES.map((o) => (
            <Chip key={o.code} name="size" checked={details.size === o.code} onToggle={() => pick('size', o.code)}>
              {o.label}
            </Chip>
          ))}
        </Question>
        <Question title="¿La pintura la compras tú o la incluye el pintor?">
          {PAINTING_PAINT_BY.map((o) => (
            <Chip key={o.code} name="paint_by" checked={details.paint_by === o.code} onToggle={() => pick('paint_by', o.code)}>
              {o.label}
            </Chip>
          ))}
        </Question>
        <Question title="¿Las paredes tienen algo de esto?">
          {PAINTING_WALL_ISSUES.map((o) => (
            <Chip key={o.code} multiple checked={details.wall_issues.includes(o.code)} onToggle={() => toggleIssue(o.code)}>
              {o.label}
            </Chip>
          ))}
        </Question>
      </div>

      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}

      <StepNav
        onBack={() => navigate(PATHS.address)}
        onNext={handleNext}
        loading={saving}
        disabled={uploading}
      />
      {uploading && <p className="mt-2 text-center text-xs text-mute">Espera a que terminen de subir los archivos.</p>}
    </>
  )
}
