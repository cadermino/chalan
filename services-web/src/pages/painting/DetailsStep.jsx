import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MediaUploader from '../../components/MediaUploader'
import StepNav from '../../components/StepNav'
import StepTracker from '../../components/StepTracker'
import { friendlyError } from '../../api'
import { track } from '../../analytics'
import { COPY, PAINTING_AREAS, PAINTING_PAINT_BY, PAINTING_SIZES, PAINTING_WALL_ISSUES, PATHS, SERVICE } from '../../config'
import { useRequest } from '../../context/RequestContext'

const DESCRIPTION_MAX = 2000

// Una opción de las preguntas rápidas. `multiple`: casilla; si no, se elige una
// y tocarla otra vez la desmarca (todas son opcionales).
function Chip({ checked, onToggle, multiple, name, children }) {
  return (
    <label
      className={`cursor-pointer select-none rounded-full border px-3 py-1.5 text-sm focus-within:ring-1 focus-within:ring-accent ${
        checked ? 'border-accent bg-accentSoft text-inkStrong' : 'border-line text-inkSoft hover:border-lineStrong'
      }`}
    >
      <input
        type={multiple ? 'checkbox' : 'radio'}
        name={name}
        className="sr-only"
        checked={checked}
        onChange={() => {}}
        onClick={onToggle}
      />
      {checked ? '✓ ' : ''}{children}
    </label>
  )
}

function Question({ title, children }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-inkStrong">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  )
}

export default function DetailsStep() {
  const { draft, saveDetails, addMedia, removeMedia } = useRequest()
  const navigate = useNavigate()
  const [details, setDetails] = useState({
    description: '', area: null, size: null, paint_by: null, wall_issues: [], ...draft.details,
  })
  const [m2, setM2] = useState(draft.details.area_m2 ? String(draft.details.area_m2) : '')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
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
      setError(COPY.emptyItems)
      return
    }
    const area = Number(m2)
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
        <div>
          <label htmlFor="painting-m2" className="mb-1 block text-sm font-semibold text-inkStrong">
            Metros cuadrados de pared, si los sabes
          </label>
          <input
            id="painting-m2"
            type="number"
            inputMode="numeric"
            min="1"
            max="5000"
            className="field w-40"
            placeholder="Ej. 60"
            value={m2}
            onChange={(event) => setM2(event.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </div>
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
