import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MediaUploader from '../../components/MediaUploader'
import StepNav from '../../components/StepNav'
import StepTracker from '../../components/StepTracker'
import { Chip, Question } from '../../components/Choices'
import { friendlyError } from '../../api'
import { saveFailure, track, trackBlocked } from '../../analytics'
import {
  COPY, MICROCEMENT_BASE_ISSUES, MICROCEMENT_BASES, MICROCEMENT_MATERIAL_BY, MICROCEMENT_ROOMS,
  MICROCEMENT_SURFACES, PATHS, SERVICE,
} from '../../config'
import { useRequest } from '../../context/RequestContext'

const DESCRIPTION_MAX = 2000

// Microcemento: como porcelanato, se cuenta con palabras o en un video. Lo que
// más mueve el precio por m² es qué hay debajo (va sobre la mayólica si está
// firme) y si el aplicador pone el material.
export default function DetailsStep() {
  const { draft, saveDetails, addMedia, removeMedia } = useRequest()
  const navigate = useNavigate()
  const [details, setDetails] = useState({
    description: '',
    surface: null,
    rooms: [],
    base: null,
    base_issues: [],
    material_by: null,
    ...draft.details,
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
  const toggle = (key, code) => set({
    [key]: details[key].includes(code) ? details[key].filter((c) => c !== code) : [...details[key], code],
  })

  const hasVideo = draft.media.some((m) => m.media_type === 'video')

  const handleNext = async () => {
    // Sin texto ni video el aplicador no sabe qué cotizar.
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
        surface: details.surface,
        rooms: details.rooms,
        base: details.base,
        base_issues: details.base_issues,
        material_by: details.material_by,
        area_m2: area,
      })
      navigate(PATHS.contact)
    } catch (err) {
      trackBlocked(SERVICE, 'items', saveFailure(err))
      setError(friendlyError(err, 'No pudimos guardar lo que contaste. Inténtalo de nuevo.'))
    } finally {
      setSaving(false)
    }
  }

  const choices = (key, options) => options.map((o) => (
    <Chip key={o.code} name={key} checked={details[key] === o.code} onToggle={() => pick(key, o.code)}>
      {o.label}
    </Chip>
  ))
  const several = (key, options) => options.map((o) => (
    <Chip key={o.code} multiple checked={details[key].includes(o.code)} onToggle={() => toggle(key, o.code)}>
      {o.label}
    </Chip>
  ))

  return (
    <>
      <StepTracker current={2} />
      <h1 className="text-2xl font-semibold text-inkStrong">¿Dónde va el microcemento?</h1>
      <p className="mt-1 text-inkSoft">
        Escríbelo o mándanos un video recorriendo el lugar y contándolo. Con eso los aplicadores te cotizan.
      </p>

      <div className="mt-6">
        <label htmlFor="microcement-description" className="mb-1 block text-sm font-semibold text-inkStrong">
          Cuéntanos qué hay que cubrir {!hasVideo && <span className="text-danger">*</span>}
        </label>
        <textarea
          id="microcement-description"
          rows={5}
          maxLength={DESCRIPTION_MAX}
          className={`field ${error ? 'border-danger' : ''}`}
          placeholder="Ej: el baño completo, piso y paredes hasta el techo, sobre la mayólica que está. Unos 18 m²."
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
        <label htmlFor="microcement-m2" className="mb-1 block text-sm font-semibold text-inkStrong">
          Metros cuadrados <span className="text-danger">*</span>
        </label>
        <input
          id="microcement-m2"
          type="number"
          inputMode="numeric"
          min="1"
          max="2000"
          className={`field w-40 ${m2Error ? 'border-danger' : ''}`}
          placeholder="Ej. 18"
          value={m2}
          onChange={(event) => { setM2Error(''); setM2(event.target.value.replace(/\D/g, '').slice(0, 4)) }}
        />
        <p className="mt-1 text-xs text-mute">
          Aproximado está bien: largo por ancho en pisos, largo por alto en paredes, todo sumado. En un baño, piso y
          paredes se suman.
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
      <p className="mt-2 text-xs text-mute">
        Una foto o un video de la superficie que hay hoy ayuda a cotizar bien: de ella depende si se puede aplicar
        encima.
      </p>

      <h2 className="mb-1 mt-8 text-lg font-semibold text-inkStrong">Si lo sabes</h2>
      <p className="mb-4 text-sm text-inkSoft">Todo opcional, pero ayuda a que te coticen más parecido.</p>
      <div className="space-y-5">
        <Question title="¿Dónde va?">{choices('surface', MICROCEMENT_SURFACES)}</Question>
        <Question title="¿En qué ambientes?">{several('rooms', MICROCEMENT_ROOMS)}</Question>
        <Question title="¿Qué hay ahora?">{choices('base', MICROCEMENT_BASES)}</Question>
        <Question title="¿La superficie tiene algo de esto?">{several('base_issues', MICROCEMENT_BASE_ISSUES)}</Question>
        <Question title="¿El material lo compras tú?">{choices('material_by', MICROCEMENT_MATERIAL_BY)}</Question>
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
