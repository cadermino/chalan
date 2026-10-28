import { useEffect, useState } from 'react'
import client from '../api/client'
import Card from './Card'
import CopyButton from './CopyButton'
import { describedFacts, formatDay } from './ServiceRequestView'
import { districtOf } from '../lib/district'

// Negocios de Google Maps que hacen este servicio (armadores, por ahora), para
// cuando no hay empresas en la plataforma que lo tomen. Como NearbyCarriers en
// las órdenes de provincia: contactos en frío. Se les escribe desde el
// WhatsApp de Chalán, así que cada uno tiene "Copiar número", y arriba se copia
// el mensaje con los datos del servicio (sin el nombre ni el teléfono del
// cliente, y del lugar solo el distrito).

const WORK = { assemble: 'armar', disassemble: 'desarmar', both: 'desarmar y armar en otro lugar' }

function itemLine(item, isAssembly) {
  const work = isAssembly && WORK[item.work] ? `: ${WORK[item.work]}` : ''
  const pack = isAssembly && item.pack ? ', con embalaje' : ''
  return `• ${item.quantity} × ${item.description}${work}${pack}`
}

function describedLines(request) {
  const code = request.service_type?.code
  if (!['painting', 'masonry'].includes(code)) return []
  return describedFacts(code, request.details || {}).map(([label, value]) => `${label}: ${value}`)
}

export function serviceMessage(request) {
  const isAssembly = request.service_type?.code === 'furniture_assembly'
  const service = (request.service_type?.name || 'un servicio').toLowerCase()
  const district = districtOf(request)
  const destination = request.details?.destination
  const lines = [
    'Hola, te escribimos de Chalán (chalan.pe), una plataforma de mudanzas y servicios para el hogar en Lima. '
      + `Tenemos un cliente que necesita ${service} y buscamos quién lo haga:`,
    '',
    `Fecha: ${formatDay(request.preferred_date)}`,
    district && `Distrito: ${district}`,
    destination && `Se arman en: ${districtOf(destination) || 'otro distrito'}`,
    request.items.length > 0 && `${isAssembly ? 'Muebles' : 'Qué hay'}:`,
    ...request.items.map((item) => itemLine(item, isAssembly)),
    // Pintura y porcelanato no tienen lista: lo que contó el cliente y sus respuestas.
    request.details?.description && `Qué hay que hacer: ${request.details.description}`,
    ...describedLines(request),
    request.media.length > 0 && `Fotos y videos: ${request.media.length} (te los pasamos)`,
    '',
    '¿Puedes ese día? Si es así, pásanos tu precio y coordinamos.',
  ]
  return lines.filter((line) => line !== false && line !== null && line !== undefined).join('\n')
}

export default function ServiceProspects({ request }) {
  const [prospects, setProspects] = useState([])
  const code = request.service_type?.code

  useEffect(() => {
    if (!code) return undefined
    let cancelled = false
    client.get(`/api/service-prospects/${code}`)
      .then(({ data }) => { if (!cancelled) setProspects(data.prospects) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [code])

  if (prospects.length === 0) return null

  return (
    <Card title={`Contactos de Google Maps (${prospects.length})`} className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-400">
          No están en la plataforma. Copia el número, escríbeles desde el WhatsApp de Chalán y pégales el mensaje.
          Al que acepte, regístralo como empresa con este servicio marcado y reenvía el servicio.
        </p>
        <CopyButton text={serviceMessage(request)} label="Copiar mensaje" />
      </div>
      <ul className="mt-3 divide-y divide-gray-100">
        {prospects.map((p) => (
          <li key={p.phone} className="flex items-start justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{p.name}</p>
              <p className="truncate text-xs text-gray-500">
                {[`★ ${Number(p.rating).toFixed(1)} (${p.reviews})`, p.does].filter(Boolean).join(' · ')}
              </p>
              <p className="truncate text-xs text-gray-400">{[p.phone, p.address].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.address || 'Lima'}`)}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-teal-600 hover:underline"
              >
                Mapa
              </a>
              <CopyButton text={p.phone.replace(/\s/g, '')} label="Copiar número" />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
