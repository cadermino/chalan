import { useState } from 'react'

// 'YYYY-MM-DD' -> 'sábado 20 de octubre'. Se arma desde las partes y se formatea en
// UTC: new Date('2026-10-20') se lee como UTC y en Lima mostraría el día anterior.
export function formatDay(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate || '')) return '—'
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('es-PE', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
  })
}

// 1234.5 -> 'S/ 1,234.50'. Los montos de embalaje llevan céntimos.
export function formatMoney(value) {
  if (value === null || value === undefined) return '—'
  return `S/ ${Number(value).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatTimestamp(iso) {
  return iso
    ? new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'medium', timeStyle: 'short' })
    : '—'
}

function Lightbox({ media, onClose }) {
  if (!media) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-4 top-4 h-10 w-10 rounded-full bg-white/20 text-2xl text-white"
      >
        ×
      </button>
      {media.media_type === 'video'
        ? <video src={media.url} controls autoPlay className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()} />
        : <img src={media.url} alt="" className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />}
    </div>
  )
}

function Thumb({ media }) {
  const [broken, setBroken] = useState(false)
  if (media.media_type === 'video') {
    // Sin controls aquí: el click abre el visor, donde sí se reproduce.
    return <video src={`${media.url}#t=0.1`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
  }
  if (broken) return <span className="text-xs text-gray-500">Foto</span>
  return <img src={media.url} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
}

function Section({ title, children }) {
  return (
    <section className="bg-white rounded-xl shadow p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">{title}</h2>
      {children}
    </section>
  )
}

// Lo que necesita un transportista para cotizar. Lo comparten la página pública
// del link y el detalle del admin, para que ambos vean exactamente lo mismo.
export default function ServiceRequestView({ request }) {
  const [opened, setOpened] = useState(null)
  const address = [request.street, request.interior].filter(Boolean).join(' · ')

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-teal-600 p-5 text-white">
        <p className="text-xs uppercase tracking-wide text-teal-100">Fecha deseada</p>
        <p className="text-2xl font-bold first-letter:uppercase">{formatDay(request.preferred_date)}</p>
        <p className="mt-1 text-sm text-teal-100">
          {request.service_type?.name} · solicitud #{request.id}
          {request.submitted_at ? ` · enviada ${formatTimestamp(request.submitted_at)}` : ''}
        </p>
      </div>

      <Section title="Dirección">
        <p className="font-medium text-gray-900">{address || '—'}</p>
        {request.neighborhood && <p className="text-sm text-gray-500">{request.neighborhood}</p>}
        {request.map_url && (
          <a href={request.map_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-teal-600 hover:underline">
            Ver en Google Maps
          </a>
        )}
      </Section>

      {request.materials_summary?.length > 0 && (
        <Section title="Materiales a llevar">
          <ul className="flex flex-wrap gap-2">
            {request.materials_summary.map((m) => (
              <li key={m.code} className="rounded-full bg-teal-50 px-3 py-1 text-sm text-teal-800">
                {m.name}: {m.items} {m.items === 1 ? 'cosa' : 'cosas'}
                {m.quantity !== m.items ? ` (${m.quantity} unid.)` : ''}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={`Qué hay que embalar (${request.items.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="py-2 pr-3">Cant.</th>
                <th className="py-2 pr-3">Cosa</th>
                <th className="py-2">Materiales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {request.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2 pr-3 align-top text-gray-500">{item.quantity}</td>
                  <td className="py-2 pr-3 align-top font-medium text-gray-900">{item.description}</td>
                  <td className="py-2 align-top">
                    {item.materials.length === 0
                      ? <span className="text-gray-400">a recomendar</span>
                      : (
                        <div className="flex flex-wrap gap-1">
                          {item.materials.map((m) => (
                            <span key={m.code} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{m.name}</span>
                          ))}
                        </div>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={`Fotos y videos (${request.media.length})`}>
        {request.media.length === 0
          ? <p className="text-sm text-gray-400">El cliente no subió fotos ni videos.</p>
          : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {request.media.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setOpened(m)}
                    className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-gray-100"
                  >
                    <Thumb media={m} />
                    {m.media_type === 'video' && (
                      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-xs text-white">▶ video</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
      </Section>

      <Lightbox media={opened} onClose={() => setOpened(null)} />
    </div>
  )
}
