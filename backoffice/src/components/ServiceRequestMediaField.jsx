import { useState } from 'react'
import { Thumb } from './ServiceRequestView'
import { ACCEPT, MAX_MEDIA, mediaProblem, pendingMedia } from '../lib/serviceRequestMedia'

// Fotos y videos que el cliente mandó por WhatsApp, en crear/editar servicio.
// Los nuevos quedan en cola y la página los sube al guardar
// (uploadPendingMedia); los ya guardados se borran al momento, con confirmación.
export default function ServiceRequestMediaField({ saved = [], pending, setPending, onDeleteSaved, disabled }) {
  const [rejected, setRejected] = useState([])
  const [confirmingId, setConfirmingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const room = MAX_MEDIA - saved.length - pending.length

  const add = (fileList) => {
    const files = Array.from(fileList)
    const problems = files.filter(mediaProblem).map((file) => `${file.name}: ${mediaProblem(file)}`)
    const valid = files.filter((file) => !mediaProblem(file))
    if (valid.length > room) problems.push(`Máximo ${MAX_MEDIA} fotos y videos por servicio.`)
    setRejected(problems)
    setPending((prev) => [...prev, ...valid.slice(0, Math.max(room, 0)).map(pendingMedia)])
  }

  const unqueue = (media) => {
    if (media.preview) URL.revokeObjectURL(media.preview)
    setPending((prev) => prev.filter((m) => m.key !== media.key))
  }

  const remove = async (id) => {
    setDeletingId(id)
    try {
      await onDeleteSaved(id)
    } finally {
      setDeletingId(null)
      setConfirmingId(null)
    }
  }

  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-1">Fotos y videos</h2>
      <p className="text-xs text-gray-400 mb-3">
        Lo que el cliente mandó por WhatsApp (hasta {MAX_MEDIA}; fotos de 10 MB, videos de 250 MB). Los transportistas
        los ven en su link. Los nuevos se suben al guardar.
      </p>

      {(saved.length > 0 || pending.length > 0) && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 mb-3">
          {saved.map((m) => (
            <li key={m.id} className="space-y-1">
              <a
                href={m.url} target="_blank" rel="noreferrer"
                className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-gray-100"
              >
                <Thumb media={m} />
                {m.media_type === 'video' && (
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-xs text-white">▶ video</span>
                )}
              </a>
              {onDeleteSaved && (confirmingId === m.id
                ? (
                  <span className="flex items-center gap-2 text-xs">
                    ¿Borrar?
                    <button type="button" onClick={() => remove(m.id)} disabled={deletingId === m.id} className="font-medium text-red-600">Sí</button>
                    <button type="button" onClick={() => setConfirmingId(null)} disabled={deletingId === m.id} className="text-gray-500">No</button>
                  </span>
                )
                : (
                  <button type="button" onClick={() => setConfirmingId(m.id)} disabled={disabled} className="text-xs text-red-600 hover:underline">
                    Borrar
                  </button>
                ))}
            </li>
          ))}
          {pending.map((m) => (
            <li key={m.key} className="space-y-1">
              <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-teal-300 bg-gray-50">
                {m.preview
                  ? <img src={m.preview} alt="" className="h-full w-full object-cover" />
                  : <span className="px-2 text-center text-xs text-gray-500 break-all">▶ {m.file.name}</span>}
                {m.progress !== null && (
                  <span className="absolute inset-x-0 bottom-0 bg-black/60 text-center text-xs text-white">{m.progress}%</span>
                )}
              </div>
              {m.error
                ? <p className="text-xs text-red-600">{m.error}</p>
                : <p className="text-xs text-gray-400">Por subir</p>}
              {m.progress === null && (
                <button type="button" onClick={() => unqueue(m)} disabled={disabled} className="text-xs text-gray-500 hover:underline">
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {room > 0 && (
        <label className={`inline-block cursor-pointer rounded-lg border border-teal-600 px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50 ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
          + Agregar fotos o videos
          <input
            type="file" accept={ACCEPT} multiple className="hidden" disabled={disabled}
            onChange={(e) => { add(e.target.files); e.target.value = '' }}
          />
        </label>
      )}

      {rejected.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-red-600">
          {rejected.map((text) => <li key={text}>{text}</li>)}
        </ul>
      )}
    </div>
  )
}
