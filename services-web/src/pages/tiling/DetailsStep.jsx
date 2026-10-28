import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MediaUploader from '../../components/MediaUploader'
import StepNav from '../../components/StepNav'
import StepTracker from '../../components/StepTracker'
import { Chip, Question } from '../../components/Choices'
import { friendlyError } from '../../api'
import { saveFailure, track, trackBlocked } from '../../analytics'
import {
  COPY, PATHS, SERVICE, TILING_MATERIALS, TILING_REMOVE_OLD, TILING_ROOMS, TILING_SCREED, TILING_SIZES,
  TILING_SURFACES, TILING_TILES_BY,
} from '../../config'
import { useRequest } from '../../context/RequestContext'

const DESCRIPTION_MAX = 2000

// Porcelanato y cerámica: como pintura, se cuenta con palabras o en un video, y
// las preguntas opcionales son las que mueven el precio por m² (formato, sacar
// el piso actual, nivelar).
export default function DetailsStep() {
  const { draft, saveDetails, addMedia, removeMedia } = useRequest()
  const navigate = useNavigate()
  const [details, setDetails] = useState({
    description: '',
    material: null,
    surface: null,
    rooms: [],
    tile_size: null,
    remove_old: null,
    screed: null,
    tiles_by: null,
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
  const toggleRoom = (code) => set({
    rooms: details.rooms.includes(code) ? details.rooms.filter((c) => c !== code) : [...details.rooms, code],
  })

  const hasVideo = draft.media.some((m) => m.media_type === 'video')

  const handleNext = async () => {
    // Sin texto ni video el instalador no sabe qué cotizar.
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
        material: details.material,
        surface: details.surface,
        rooms: details.rooms,
        tile_size: details.tile_size,
        remove_old: details.remove_old,
        screed: details.screed,
        tiles_by: details.tiles_by,
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

  const choices = (key, options) => options.map((o) => (
    <Chip key={o.code} name={key} checked={details[key] === o.code} onToggle={() => pick(key, o.code)}>
      {o.label}
    </Chip>
  ))

  return (
    <>
      <StepTracker current={2} />
      <h1 className="text-2xl font-semibold text-inkStrong">¿Qué quieres instalar?</h1>
      <p className="mt-1 text-inkSoft">
        Escríbelo o mándanos un video recorriendo el lugar y contándolo. Con eso los instaladores te cotizan.
      </p>

      <div className="mt-6">
        <label htmlFor="tiling-description" className="mb-1 block text-sm font-semibold text-inkStrong">
          Cuéntanos qué hay que instalar {!hasVideo && <span className="text-danger">*</span>}
        </label>
        <textarea
          id="tiling-description"
          rows={5}
          maxLength={DESCRIPTION_MAX}
          className={`field ${error ? 'border-danger' : ''}`}
          placeholder="Ej: porcelanato en la sala, el comedor y la cocina, unos 35 m². Hay que sacar la cerámica que está."
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
        <label htmlFor="tiling-m2" className="mb-1 block text-sm font-semibold text-inkStrong">
          Metros cuadrados <span className="text-danger">*</span>
        </label>
        <input
          id="tiling-m2"
          type="number"
          inputMode="numeric"
          min="1"
          max="2000"
          className={`field w-40 ${m2Error ? 'border-danger' : ''}`}
          placeholder="Ej. 35"
          value={m2}
          onChange={(event) => { setM2Error(''); setM2(event.target.value.replace(/\D/g, '').slice(0, 4)) }}
        />
        <p className="mt-1 text-xs text-mute">
          Aproximado está bien: largo por ancho de cada ambiente, sumados. Si va en paredes, largo por alto.
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
      <p className="mt-2 text-xs text-mute">Una foto o un video del piso actual ayuda a cotizar bien.</p>

      <h2 className="mb-1 mt-8 text-lg font-semibold text-inkStrong">Si lo sabes</h2>
      <p className="mb-4 text-sm text-inkSoft">Todo opcional, pero ayuda a que te coticen más parecido.</p>
      <div className="space-y-5">
        <Question title="¿Qué material?">{choices('material', TILING_MATERIALS)}</Question>
        <Question title="¿Dónde va?">{choices('surface', TILING_SURFACES)}</Question>
        <Question title="¿En qué ambientes?">
          {TILING_ROOMS.map((o) => (
            <Chip key={o.code} multiple checked={details.rooms.includes(o.code)} onToggle={() => toggleRoom(o.code)}>
              {o.label}
            </Chip>
          ))}
        </Question>
        <Question title="¿De qué tamaño son las piezas?">{choices('tile_size', TILING_SIZES)}</Question>
        <Question title="¿Hay que sacar el piso que está ahora?">{choices('remove_old', TILING_REMOVE_OLD)}</Question>
        <Question title="¿Hace falta contrapiso o nivelar?">{choices('screed', TILING_SCREED)}</Question>
        <Question title="¿El porcelanato o la cerámica los compras tú?">{choices('tiles_by', TILING_TILES_BY)}</Question>
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
