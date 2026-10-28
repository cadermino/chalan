import { useState } from 'react'
import Card from './Card'

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

export function Thumb({ media }) {
  const [broken, setBroken] = useState(false)
  if (media.media_type === 'video') {
    // Sin controls aquí: el click abre el visor, donde sí se reproduce.
    return <video src={`${media.url}#t=0.1`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
  }
  if (broken) return <span className="text-xs text-gray-500">Foto</span>
  return <img src={media.url} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
}

const WORK_LABELS = { assemble: 'Armar', disassemble: 'Desarmar', both: 'Desarmar y armar' }

function MaterialChips({ materials, empty }) {
  if (materials.length === 0) return <span className="text-gray-400">{empty}</span>
  return (
    <div className="flex flex-wrap gap-1">
      {materials.map((m) => (
        <span key={m.code} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{m.name}</span>
      ))}
    </div>
  )
}

function AddressBlock({ address }) {
  const line = [address.street, address.interior].filter(Boolean).join(' · ')
  return (
    <>
      <p className="font-medium text-gray-900">{line || '—'}</p>
      {address.neighborhood && <p className="text-sm text-gray-500">{address.neighborhood}</p>}
      {address.map_url && (
        <a href={address.map_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-teal-600 hover:underline">
          Ver en Google Maps
        </a>
      )}
    </>
  )
}

// Lo que necesita un transportista para cotizar. Lo comparten la página pública
// del link y el detalle del admin, para que ambos vean exactamente lo mismo.
// Las respuestas rápidas de pintura, todas opcionales. Los codes los valida el
// API principal (PAINTING_* en app/api/service_request/types.py); las mismas
// etiquetas que ve el cliente en services-web (config.js).
export const PAINTING_LABELS = {
  area: { interior: 'Interior', exterior: 'Exterior o fachada', both: 'Interior y exterior' },
  size: { detail: 'Una pared o un detalle', one_room: '1 ambiente', few_rooms: '2 a 3 ambientes', whole: 'Depa o casa completa' },
  paint_by: { customer: 'La compra el cliente', painter: 'La incluye el pintor', unsure: 'No sabe, que le recomienden' },
  wall_issues: { humidity: 'Humedad', cracks: 'Rajaduras', putty: 'Necesitan empaste' },
}

// Las de porcelanato y cerámica (`masonry`). Codes: TILING_* en
// app/api/service_request/types.py; las mismas etiquetas que services-web.
export const TILING_LABELS = {
  material: { porcelain: 'Porcelanato', ceramic: 'Cerámica', unsure: 'Aún no sabe' },
  surface: { floor: 'Piso', wall: 'Pared', both: 'Piso y pared' },
  rooms: {
    living: 'Sala y comedor', bedrooms: 'Dormitorios', kitchen: 'Cocina', bathrooms: 'Baños',
    terrace: 'Terraza o patio', stairs: 'Escaleras',
  },
  tile_size: { '60x60': '60×60 o más chico', '60x120': '60×120 o más grande', other: 'Otro o no sabe' },
  remove_old: { yes: 'Sí', no: 'No, el piso está libre' },
  screed: { yes: 'Sí', no: 'No', unsure: 'No sabe' },
  tiles_by: { customer: 'Lo compra el cliente', installer: 'Lo incluye el instalador', unsure: 'No sabe, que le recomienden' },
}

// Las respuestas de un servicio que se cuenta con palabras, en [etiqueta, valor].
export function describedFacts(code, details = {}) {
  if (code === 'masonry') {
    return [
      ['Material', TILING_LABELS.material[details.material]],
      ['Dónde', TILING_LABELS.surface[details.surface]],
      ['Ambientes', (details.rooms || []).map((c) => TILING_LABELS.rooms[c]).join(', ') || null],
      ['Metros', details.area_m2 ? `${details.area_m2} m²` : null],
      ['Formato', TILING_LABELS.tile_size[details.tile_size]],
      ['Sacar el piso actual', TILING_LABELS.remove_old[details.remove_old]],
      ['Contrapiso o nivelar', TILING_LABELS.screed[details.screed]],
      ['Quién compra', TILING_LABELS.tiles_by[details.tiles_by]],
    ].filter(([, value]) => value)
  }
  return [
    ['Dónde', PAINTING_LABELS.area[details.area]],
    ['Cuánto', PAINTING_LABELS.size[details.size]],
    ['Metros de pared', details.area_m2 ? `${details.area_m2} m²` : null],
    ['Pintura', PAINTING_LABELS.paint_by[details.paint_by]],
    ['Paredes', (details.wall_issues || []).map((c) => PAINTING_LABELS.wall_issues[c]).join(', ') || null],
  ].filter(([, value]) => value)
}

function DescribedDetails({ code, details, media }) {
  const facts = describedFacts(code, details)
  const hasVideo = media.some((m) => m.media_type === 'video')

  return (
    <Card title={code === 'masonry' ? 'Qué hay que instalar' : 'Qué hay que pintar'}>
      {details.description
        ? <p className="whitespace-pre-line text-sm text-gray-900">{details.description}</p>
        : <p className="text-sm text-gray-500">{hasVideo ? 'Lo explica en el video.' : 'Sin descripción.'}</p>}
      {facts.length > 0 && (
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <dt className="text-gray-400">{label}:</dt>
              <dd className="text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  )
}

export default function ServiceRequestView({ request }) {
  const [opened, setOpened] = useState(null)
  // Armado de muebles: cada mueble dice qué hacer y si se embala, y los que se
  // desarman y arman van a una segunda dirección.
  const isAssembly = request.service_type?.code === 'furniture_assembly'
  // Pintura y porcelanato no tienen lista: lo que piden va en details (o en un video).
  const isDescribed = ['painting', 'masonry'].includes(request.service_type?.code)
  const destination = request.details?.destination

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-teal-600 p-5 text-white">
        <p className="text-xs uppercase tracking-wide text-teal-100">Fecha deseada</p>
        <p className="text-2xl font-bold first-letter:uppercase">{formatDay(request.preferred_date)}</p>
        <p className="mt-1 text-sm text-teal-100">
          {request.service_type?.name} · #{request.id}
          {request.submitted_at ? ` · enviada ${formatTimestamp(request.submitted_at)}` : ''}
        </p>
      </div>

      <Card title={destination ? 'Dirección (dónde se desarman)' : 'Dirección'}>
        <AddressBlock address={request} />
      </Card>

      {destination && (
        <Card title="Destino (dónde se arman)">
          <AddressBlock address={destination} />
          <p className="mt-2 text-xs text-gray-400">El traslado de los muebles no está incluido.</p>
        </Card>
      )}

      {request.materials_summary?.length > 0 && (
        <Card title={isAssembly ? 'Materiales para embalar' : 'Materiales a llevar'}>
          <ul className="flex flex-wrap gap-2">
            {request.materials_summary.map((m) => (
              <li key={m.code} className="rounded-full bg-teal-50 px-3 py-1 text-sm text-teal-800">
                {m.name}: {m.items} {m.items === 1 ? 'cosa' : 'cosas'}
                {m.quantity !== m.items ? ` (${m.quantity} unid.)` : ''}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isDescribed && (
        <DescribedDetails code={request.service_type?.code} details={request.details || {}} media={request.media} />
      )}

      {!isDescribed && (
      <Card title={`${isAssembly ? 'Muebles' : 'Qué hay que embalar'} (${request.items.length})`}>
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-400">
              <tr>
                <th className="py-2 pr-3">Cant.</th>
                <th className="py-2 pr-3">{isAssembly ? 'Mueble' : 'Cosa'}</th>
                {isAssembly && <th className="py-2 pr-3">Trabajo</th>}
                <th className="py-2">{isAssembly ? 'Embalaje' : 'Materiales'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {request.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2 pr-3 align-top text-gray-500">{item.quantity}</td>
                  <td className="py-2 pr-3 align-top font-medium text-gray-900">{item.description}</td>
                  {isAssembly && (
                    <td className="py-2 pr-3 align-top text-gray-900">{WORK_LABELS[item.work] || item.work || '—'}</td>
                  )}
                  <td className="py-2 align-top">
                    {isAssembly && !item.pack
                      ? <span className="text-gray-400">no</span>
                      : <MaterialChips materials={item.materials} empty="a recomendar" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      )}

      <Card title={`Fotos y videos (${request.media.length})`}>
        {request.media.length === 0
          ? <p className="text-sm text-gray-400">No hay fotos ni videos.</p>
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
      </Card>

      <Lightbox media={opened} onClose={() => setOpened(null)} />
    </div>
  )
}
