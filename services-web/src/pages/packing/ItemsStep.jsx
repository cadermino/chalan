import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ItemsEditor from '../../components/ItemsEditor'
import MediaUploader from '../../components/MediaUploader'
import StepNav from '../../components/StepNav'
import StepTracker from '../../components/StepTracker'
import { friendlyError, getMaterials } from '../../api'
import { track } from '../../analytics'
import { PATHS, SERVICE } from '../../config'
import { newItem, useRequest } from '../../context/RequestContext'

export default function ItemsStep() {
  const { draft, setItems, saveItems, addMedia, removeMedia } = useRequest()
  const navigate = useNavigate()
  const [materials, setMaterials] = useState(null)
  const [loadError, setLoadError] = useState(false)
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

  const handleNext = async () => {
    // Las filas en blanco no cuentan: se descartan en vez de frenar al cliente.
    const filled = draft.items
      .map((item) => ({ ...item, description: item.description.trim() }))
      .filter((item) => item.description)
    if (filled.length === 0) {
      setError('Agrega al menos una cosa para embalar.')
      return
    }
    setSaving(true)
    try {
      await saveItems(filled)
      navigate(PATHS.contact)
    } catch (err) {
      setError(friendlyError(err, 'No pudimos guardar la lista. Inténtalo de nuevo.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <StepTracker current={2} />
      <h1 className="text-2xl font-semibold text-inkStrong">¿Qué hay que embalar?</h1>
      <p className="mt-1 text-inkSoft">Lista las cosas y marca con qué quieres que se embalen.</p>

      <div className="mt-6">
        {loadError && (
          <div role="alert" className="rounded-lg border border-line bg-paper2 p-4 text-sm">
            <p className="text-inkStrong">No pudimos cargar los materiales.</p>
            <button type="button" className="btn-secondary mt-3" onClick={loadMaterials}>Reintentar</button>
          </div>
        )}
        {!loadError && !materials && <p className="py-8 text-center text-inkSoft">Cargando…</p>}
        {materials && (
          <ItemsEditor
            items={draft.items}
            materials={materials}
            onChange={(items) => { setError(''); setItems(items) }}
          />
        )}
        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      </div>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-inkStrong">Fotos o videos</h2>
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
        disabled={!materials || uploading}
      />
      {uploading && <p className="mt-2 text-center text-xs text-mute">Espera a que terminen de subir los archivos.</p>}
    </>
  )
}
