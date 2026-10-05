import { useEffect, useRef, useState } from 'react'
import { deleteMedia, presignMedia, registerMedia, uploadToStorage } from '../api'
import { track } from '../analytics'
import { SERVICE } from '../config'
import { MAX_MEDIA, contentTypeOf, problemWith } from '../media'

function Thumb({ media }) {
  const [broken, setBroken] = useState(false)
  if (media.media_type === 'video') {
    return (
      // #t=0.1 hace que el navegador pinte un cuadro como miniatura.
      <video src={`${media.url}#t=0.1`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
    )
  }
  // Los HEIC solo los muestra Safari: si no cargan se deja un ícono, la foto igual se subió.
  if (broken) return <span className="text-xs text-inkSoft">Foto</span>
  return <img src={media.url} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setBroken(true)} />
}

// Sube fotos y videos directo a S3 (presigned POST), de a uno, con progreso. Un
// archivo que falla no frena a los demás.
export default function MediaUploader({ publicId, media, onAdded, onRemoved, onBusyChange }) {
  const [uploads, setUploads] = useState([]) // {id, name, progress, error}
  const [removing, setRemoving] = useState(null)
  const [removeError, setRemoveError] = useState('')
  const inputRef = useRef(null)
  const counter = useRef(0)

  const busy = uploads.some((u) => !u.error)
  useEffect(() => { onBusyChange(busy) }, [busy, onBusyChange])

  const patchUpload = (id, fields) =>
    setUploads((list) => list.map((u) => (u.id === id ? { ...u, ...fields } : u)))
  const dropUpload = (id) => setUploads((list) => list.filter((u) => u.id !== id))

  const uploadOne = async (file, id) => {
    try {
      const contentType = contentTypeOf(file)
      const { upload, storage_key: storageKey } = await presignMedia(publicId, {
        content_type: contentType,
        size_bytes: file.size,
      })
      // S3 valida el Content-Type firmado: el campo tiene que coincidir con el del archivo.
      const typedFile = file.type === contentType ? file : new File([file], file.name, { type: contentType })
      await uploadToStorage(upload, typedFile, (progress) => patchUpload(id, { progress }))
      const saved = await registerMedia(publicId, storageKey)
      onAdded(saved)
      track('service_request_media_uploaded', { service: SERVICE, media_type: saved.media_type })
      dropUpload(id)
    } catch (err) {
      const message = err?.response?.data?.message
      patchUpload(id, {
        error: message && message.includes('at most')
          ? `Máximo ${MAX_MEDIA} archivos.`
          : 'No se pudo subir. Inténtalo de nuevo.',
      })
    }
  }

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = '' // permite elegir el mismo archivo otra vez
    let slots = MAX_MEDIA - media.length - uploads.filter((u) => !u.error).length
    const queue = []
    const rejected = []
    files.forEach((file) => {
      const id = `upload-${counter.current++}`
      const problem = slots <= 0 ? `Máximo ${MAX_MEDIA} archivos.` : problemWith(file)
      if (problem) {
        rejected.push({ id, name: file.name, progress: 0, error: problem })
        return
      }
      slots -= 1
      queue.push({ file, upload: { id, name: file.name, progress: 0, error: null } })
    })
    setUploads((list) => [...list, ...rejected, ...queue.map((q) => q.upload)])
    for (const { file, upload } of queue) {
      // Secuencial a propósito: en un celular, varios videos a la vez compiten por el mismo ancho de banda.
      // eslint-disable-next-line no-await-in-loop
      await uploadOne(file, upload.id)
    }
  }

  const handleRemove = async (item) => {
    setRemoving(item.id)
    setRemoveError('')
    try {
      await deleteMedia(publicId, item.id)
      onRemoved(item.id)
    } catch (err) {
      // Si no se pudo borrar, sigue en la lista: mostrar que se fue mentiría.
      setRemoveError('No se pudo quitar el archivo. Inténtalo de nuevo.')
    } finally {
      setRemoving(null)
    }
  }

  const full = media.length >= MAX_MEDIA

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />
      <button type="button" className="btn-secondary w-full" disabled={full} onClick={() => inputRef.current.click()}>
        + Subir fotos o videos
      </button>
      <p className="mt-1 text-xs text-mute">
        Opcional, pero ayuda a cotizar mejor. Hasta {MAX_MEDIA} archivos: fotos de 10 MB o videos de 100 MB.
      </p>

      {uploads.length > 0 && (
        <ul className="mt-3 space-y-2">
          {uploads.map((u) => (
            <li key={u.id} className="rounded-lg border border-line bg-paper2 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-inkStrong">{u.name}</span>
                {u.error
                  ? <button type="button" className="shrink-0 text-mute underline" onClick={() => dropUpload(u.id)}>Cerrar</button>
                  : <span className="shrink-0 text-inkSoft">{u.progress}%</span>}
              </div>
              {u.error
                ? <p role="alert" className="mt-1 text-danger">{u.error}</p>
                : (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={u.progress} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full bg-accent transition-all" style={{ width: `${u.progress}%` }} />
                  </div>
                )}
            </li>
          ))}
        </ul>
      )}

      {removeError && <p role="alert" className="mt-2 text-sm text-danger">{removeError}</p>}

      {media.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {media.map((item) => (
            <li key={item.id} className="relative aspect-square overflow-hidden rounded-lg border border-line bg-paper2">
              <div className="flex h-full w-full items-center justify-center"><Thumb media={item} /></div>
              <button
                type="button"
                aria-label="Quitar archivo"
                disabled={removing === item.id}
                onClick={() => handleRemove(item)}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-paper/90 text-inkStrong disabled:opacity-50"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
