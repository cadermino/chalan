import { useEffect, useState } from 'react'
import client from '../api/client'

// Transportistas de Google Maps de la zona de una orden que no es de Lima.
// Son contactos en frío (repo automajob-contacts), no empresas de la plataforma:
// el botón abre WhatsApp con un mensaje listo para invitarlos a cotizar.
// El mensaje no lleva datos del cliente, solo la zona, lo que se transporta y la fecha.

const TYPE_LABELS = { mudanza: 'Mudanza', vehiculos: 'Vehículos', carga: 'Carga' }
const NEED_PHRASES = {
  vehiculos: 'transportar un vehículo',
  construccion: 'transportar material de construcción',
  carga: 'transportar carga',
  mudanza: 'hacer una mudanza',
  todos: 'un servicio de transporte',
}
const END_LABELS = { origin: 'Origen', destination: 'Destino' }

function digits(phone) {
  return (phone || '').replace(/\D/g, '')
}

// +51999111222 -> +51 999 111 222
function prettyPhone(phone) {
  const d = digits(phone)
  return d.length === 11 ? `+${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : phone
}

function whatsappUrl(carrier, { department, need, appointmentDate }) {
  const date = appointmentDate ? new Date(appointmentDate) : null
  const when = date && !Number.isNaN(date.getTime())
    ? ` para el ${date.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' })}`
    : ''
  const text =
    `Hola, te escribe Chalán (chalan.pe), una plataforma de mudanzas y fletes. ` +
    `Tenemos un cliente en ${department} que necesita ${NEED_PHRASES[need] || NEED_PHRASES.todos}${when}. ` +
    `¿Te interesaría cotizar? Si es así, te mandamos los detalles.`
  return `https://wa.me/${digits(carrier.phone)}?text=${encodeURIComponent(text)}`
}

export default function NearbyCarriers({ orderId, appointmentDate }) {
  const [data, setData] = useState(null)
  const [need, setNeed] = useState(null)
  const [end, setEnd] = useState(null)

  useEffect(() => {
    let cancelled = false
    const params = {}
    if (need) params.need = need
    if (end) params.end = end
    client
      .get(`/api/orders/${orderId}/nearby-carriers`, { params })
      .then(({ data: body }) => { if (!cancelled) setData(body) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [orderId, need, end])

  if (!data) return null

  if (!data.applicable) {
    if (data.reason !== 'unknown') return null
    return (
      <p className="text-xs text-gray-400">
        No pude ubicar la dirección de esta orden, así que no hay transportistas de la zona para sugerir.
      </p>
    )
  }

  const outside = data.ends.filter((e) => e.lima === false)
  const department = data.location.department
  const total = data.counts.todos

  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-3">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-gray-700">Transportistas en {department}</p>
          {outside.length > 1 && (
            <div className="flex gap-1">
              {outside.map((e) => (
                <button
                  key={e.end}
                  onClick={() => { setEnd(e.end); setNeed(null) }}
                  className={`text-xs px-2.5 py-1 rounded-full border ${
                    data.end === e.end
                      ? 'bg-teal-600 border-teal-600 text-white'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {END_LABELS[e.end]}: {e.department}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          Contactos de Google Maps, no están en la plataforma. Invítalos a cotizar por WhatsApp.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {data.needs.map((n) => (
          <button
            key={n.value}
            onClick={() => setNeed(n.value)}
            className={`text-xs px-2.5 py-1 rounded-full border ${
              data.need === n.value
                ? 'bg-teal-600 border-teal-600 text-white'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {n.label} ({data.counts[n.value] ?? 0})
          </button>
        ))}
      </div>
      {data.detected.length > 0 && data.need !== 'todos' && data.need === data.detected[0] && (
        <p className="text-xs text-gray-500">
          Elegido según lo que escribió el cliente. Si no calza, cambia el filtro.
        </p>
      )}

      {data.carriers.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay transportistas de este tipo en {department}
          {total > 0 ? `. Prueba con «Todos» (${total}).` : '.'}
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          {data.carriers.map((c) => (
            <div key={c.id} className="py-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {c.name}
                  {c.type && (
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-teal-700 bg-teal-50 rounded px-1.5 py-0.5">
                      {TYPE_LABELS[c.type] || c.type}
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {[
                    c.category,
                    c.rating != null ? `★ ${c.rating}${c.reviews ? ` (${c.reviews})` : ''}` : null,
                    c.distance_km != null ? `a ${c.distance_km} km` : null,
                  ].filter(Boolean).join(' · ')}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {prettyPhone(c.phone)}
                  {c.address ? ` · ${c.address}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.maps_url && (
                  <a
                    href={c.maps_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-teal-600 hover:underline"
                  >
                    Mapa
                  </a>
                )}
                <a
                  href={whatsappUrl(c, { department, need: data.need, appointmentDate })}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white"
                >
                  WhatsApp
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
