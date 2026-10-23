import { useState } from 'react'
import { MAX_VIDEOS, pendingVideo, videoProblem } from '../lib/orderVideos'

const fieldLabel = 'text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1'

function sizeLabel(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Videos de la carga en crear/editar orden. Los nuevos quedan en cola y la
// página los sube al guardar (uploadPendingVideos), igual que las fotos; los
// ya guardados se borran al momento.
export default function OrderVideosField({
  existing = [], pending, setPending, onDeleteExisting, deletingId, disabled,
}) {
  const [rejected, setRejected] = useState([])
  const room = MAX_VIDEOS - existing.length - pending.length

  const add = (fileList) => {
    const files = Array.from(fileList)
    const problems = files
      .map(file => ({ file, problem: videoProblem(file) }))
      .filter(f => f.problem)
      .map(f => `${f.file.name}: ${f.problem}`)
    const valid = files.filter(file => !videoProblem(file))
    if (valid.length > room) problems.push(`Máximo ${MAX_VIDEOS} videos por orden.`)
    setRejected(problems)
    setPending(prev => [...prev, ...valid.slice(0, Math.max(room, 0)).map(pendingVideo)])
  }

  const remove = (key) => setPending(prev => prev.filter(v => v.key !== key))

  return (
    <div className="bg-white rounded-xl shadow p-5">
      <label className={fieldLabel}>Videos de la carga</label>
      <p className="text-xs text-gray-500 mb-3">
        Videos que el cliente haya mandado por WhatsApp (opcional, hasta {MAX_VIDEOS}, de 250 MB cada uno).
        Los transportistas los ven en su link de cotización.
      </p>

      {existing.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {existing.map(video => (
            <div key={video.id} className="relative">
              <video
                src={video.url}
                controls
                preload="metadata"
                className="w-full h-40 rounded-md border border-gray-200 bg-black"
              />
              {onDeleteExisting && (
                <button
                  type="button"
                  onClick={() => onDeleteExisting(video.id)}
                  disabled={deletingId === video.id}
                  className="absolute top-1 right-1 bg-white/90 rounded-full w-5 h-5 flex items-center justify-center text-xs text-gray-600 hover:text-red-600 shadow disabled:opacity-50"
                  aria-label="Borrar video"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {room > 0 && (
        <input
          type="file"
          accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
          multiple
          disabled={disabled}
          onChange={e => { add(e.target.files); e.target.value = '' }}
          className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-teal-50 file:text-teal-700 file:text-sm hover:file:bg-teal-100"
        />
      )}

      {rejected.length > 0 && (
        <ul className="mt-2 text-xs text-red-600 space-y-0.5">
          {rejected.map(text => <li key={text}>{text}</li>)}
        </ul>
      )}

      {pending.length > 0 && (
        <ul className="mt-3 space-y-2">
          {pending.map(video => (
            <li key={video.key} className="text-sm border border-gray-200 rounded-md px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="truncate flex-1 text-gray-700">{video.file.name}</span>
                <span className="text-xs text-gray-400 shrink-0">{sizeLabel(video.file.size)}</span>
                {video.progress === null && (
                  <button
                    type="button"
                    onClick={() => remove(video.key)}
                    disabled={disabled}
                    className="text-xs text-gray-500 hover:text-red-600 disabled:opacity-50"
                    aria-label="Quitar video"
                  >
                    ×
                  </button>
                )}
              </div>
              {video.progress !== null && (
                <div className="mt-1.5 h-1.5 bg-gray-100 rounded">
                  <div className="h-1.5 bg-teal-500 rounded" style={{ width: `${video.progress}%` }} />
                </div>
              )}
              {video.error && <p className="text-xs text-red-600 mt-1">{video.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
