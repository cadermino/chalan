import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AddressFields from '../../components/AddressFields'
import FurnitureEditor from '../../components/FurnitureEditor'
import MediaUploader from '../../components/MediaUploader'
import StepNav from '../../components/StepNav'
import StepTracker from '../../components/StepTracker'
import { friendlyError, getMaterials } from '../../api'
import { saveFailure, track, trackBlocked } from '../../analytics'
import { COPY, PATHS, SERVICE, whatsappUrl } from '../../config'
import { EMPTY_ADDRESS, newItem, useRequest } from '../../context/RequestContext'

export default function ItemsStep() {
  const { draft, setItems, saveItems, addMedia, removeMedia } = useRequest()
  const navigate = useNavigate()
  const [materials, setMaterials] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [destination, setDestination] = useState(draft.destination || EMPTY_ADDRESS)
  const [destinationError, setDestinationError] = useState('')
  const [mapsError, setMapsError] = useState(false)
  const [missingWork, setMissingWork] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const loadMaterials = useCallback(() => {
    setLoadError(false)
    getMaterials(SERVICE).then(setMaterials).catch(() => setLoadError(true))
  }, [])

  useEffect(() => {
    track('service_request_step_view', { service: SERVICE, step: 'items' })
    loadMaterials()
    // Una fila en blanco para que no se vea una pantalla vacía.
    if (draft.items.length === 0) setItems([newItem()])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const needsDestination = draft.items.some((item) => item.work === 'both')

  const handleNext = async () => {
    // Las filas en blanco no cuentan: se descartan en vez de frenar al cliente.
    const filled = draft.items
      .map((item) => ({ ...item, description: item.description.trim() }))
      .filter((item) => item.description)
    if (filled.length === 0) {
      trackBlocked(SERVICE, 'items', 'items')
      setError(COPY.emptyItems)
      return
    }
    if (filled.some((item) => !item.work)) {
      trackBlocked(SERVICE, 'items', 'work')
      setMissingWork(true)
      setError('Falta elegir qué hacer con algún mueble.')
      return
    }
    if (needsDestination && !destination.map_url) {
      trackBlocked(SERVICE, 'items', 'destination_map_url')
      setDestinationError('Elige la dirección de la lista de sugerencias.')
      return
    }
    setSaving(true)
    try {
      await saveItems(filled, needsDestination ? destination : null)
      navigate(PATHS.contact)
    } catch (err) {
      trackBlocked(SERVICE, 'items', saveFailure(err))
      setError(friendlyError(err, 'No pudimos guardar la lista. Inténtalo de nuevo.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <StepTracker current={2} />
      <h1 className="text-2xl font-semibold text-inkStrong">¿Qué muebles son?</h1>
      <p className="mt-1 text-inkSoft">Lista los muebles y dinos qué hay que hacer con cada uno.</p>

      <div className="mt-6">
        {loadError && (
          <div role="alert" className="rounded-lg border border-line bg-paper2 p-4 text-sm">
            <p className="text-inkStrong">No pudimos cargar la lista. Revisa tu conexión.</p>
            <button type="button" className="btn-secondary mt-3" onClick={loadMaterials}>Reintentar</button>
          </div>
        )}
        {!loadError && !materials && <p className="py-8 text-center text-inkSoft">Cargando…</p>}
        {materials && (
          <FurnitureEditor
            items={draft.items}
            materials={materials}
            missingWork={missingWork}
            onChange={(items) => { setError(''); setItems(items) }}
          />
        )}
        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      </div>

      {needsDestination && (
        <section className="mt-8 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-inkStrong">¿Dónde se arman?</h2>
            <p className="mt-1 text-sm text-inkSoft">
              La dirección a la que llegan los muebles que se desarman. El traslado no está incluido.
            </p>
          </div>
          <AddressFields
            id="destination"
            label="Dirección de destino"
            address={destination}
            onChange={(next) => { setDestinationError(''); setDestination(next) }}
            error={destinationError}
            mapsError={mapsError}
            onMapsError={() => setMapsError(true)}
          />
          {mapsError && (
            <div role="alert" className="rounded-lg border border-line bg-paper2 p-4 text-sm">
              <p className="text-inkStrong">No pudimos cargar el buscador de direcciones.</p>
              <p className="mt-1 text-inkSoft">Recarga la página o cuéntanos qué necesitas por WhatsApp.</p>
              <a className="btn-primary mt-3" href={whatsappUrl(COPY.whatsappAsk)} target="_blank" rel="noopener noreferrer">
                Escribir por WhatsApp
              </a>
            </div>
          )}
        </section>
      )}

      <h2 className="mb-1 mt-8 text-lg font-semibold text-inkStrong">Fotos o videos</h2>
      <p className="mb-2 text-sm text-inkSoft">
        De los muebles armados, o de la caja si son nuevos. Con eso te cotizan más rápido y mejor.
      </p>
      <MediaUploader
        publicId={draft.publicId}
        media={draft.media}
        onAdded={addMedia}
        onRemoved={removeMedia}
        onBusyChange={setUploading}
      />

      <StepNav
        onBack={() => navigate(PATHS.address)}
        onNext={handleNext}
        loading={saving}
        disabled={!materials || uploading || (needsDestination && mapsError)}
      />
      {uploading && <p className="mt-2 text-center text-xs text-mute">Espera a que terminen de subir los archivos.</p>}
    </>
  )
}
