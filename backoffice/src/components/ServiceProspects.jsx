import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
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

const GREETING = 'Hola, te escribimos de Chalán (chalan.pe), una plataforma de mudanzas y servicios para el hogar en Lima.'
const CLOSING = '¿Puedes ese día? Si es así, pásanos tu precio y coordinamos.'

export function serviceMessage(request) {
  const isAssembly = request.service_type?.code === 'furniture_assembly'
  const service = (request.service_type?.name || 'un servicio').toLowerCase()
  const district = districtOf(request)
  const destination = request.details?.destination
  // Con el link (chalan.pe/v/…) el detalle y las fotos van en la página: el
  // mensaje queda corto, que en WhatsApp se lee mejor.
  if (request.share_path) {
    return [
      `${GREETING} Tenemos un cliente que necesita ${service}${district ? ` en ${district}` : ''}`
        + ` para el ${formatDay(request.preferred_date)}.`,
      '',
      `Todo el detalle y las fotos: ${window.location.origin}${request.share_path}`,
      '',
      CLOSING,
    ].join('\n')
  }
  const lines = [
    `${GREETING} Tenemos un cliente que necesita ${service} y buscamos quién lo haga:`,
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
    CLOSING,
  ]
  return lines.filter((line) => line !== false && line !== null && line !== undefined).join('\n')
}

// Cargar el precio que un contacto mandó por WhatsApp, con un comentario para el
// cliente. Por detrás se crea su empresa (inactiva) si no existe:
// backoffice-api contact-quotations.
function ContactQuoteForm({ request, contact, onSaved, onCancel }) {
  const [form, setForm] = useState({ name: contact?.name || '', phone: contact?.phone || '', amount: '', note: '' })
  const [saving, setSaving] = useState(false)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await client.post(`/api/service-requests/${request.id}/contact-quotations`, {
        name: form.name, phone: form.phone, amount: Number(form.amount), note: form.note.trim() || null,
      })
      toast.success('Cotización agregada: el cliente ya la ve')
      onSaved()
    } catch (err) {
      toast.error(err.response?.status === 409
        ? 'Este servicio ya tiene una cotización elegida.'
        : 'No se pudo guardar. Revisa el precio y el teléfono.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="mt-2 space-y-2 rounded-lg border border-teal-200 bg-teal-50/40 p-3">
      {!contact && (
        <div className="grid grid-cols-2 gap-2">
          <input required placeholder="Nombre" maxLength={45} value={form.name} onChange={set('name')} className="input" />
          <input required placeholder="WhatsApp (9 dígitos)" value={form.phone} onChange={set('phone')} className="input" />
        </div>
      )}
      <div>
        <label className="text-xs text-gray-500">Su precio (S/) *</label>
        <input
          required type="number" min={1} step="0.01" value={form.amount} onChange={set('amount')}
          className="input w-40" placeholder="Ej. 150"
        />
        <p className="text-xs text-gray-400">Lo que cobra él. Al cliente se le suma lo de Chalán, como a cualquier cotización.</p>
      </div>
      <div>
        <label className="text-xs text-gray-500">Comentario para el cliente</label>
        <textarea
          rows={2} maxLength={500} value={form.note} onChange={set('note')} className="input"
          placeholder="Lo que dijo por WhatsApp que el cliente debe saber. Ej. Voy con un ayudante, incluye embalar."
        />
      </div>
      <div className="flex gap-3">
        <button
          type="submit" disabled={saving}
          className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar cotización'}
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-gray-500 hover:underline">Cancelar</button>
      </div>
    </form>
  )
}

export default function ServiceProspects({ request, onSaved }) {
  const [prospects, setProspects] = useState([])
  // El contacto al que se le está cargando la cotización: su teléfono, u 'other'.
  const [quoting, setQuoting] = useState(null)
  const code = request.service_type?.code
  const canQuote = Boolean(request.submitted_at)

  useEffect(() => {
    if (!code) return undefined
    let cancelled = false
    client.get(`/api/service-prospects/${code}`)
      .then(({ data }) => { if (!cancelled) setProspects(data.prospects) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [code])

  if (prospects.length === 0 && !canQuote) return null
  const saved = () => { setQuoting(null); onSaved() }

  return (
    <Card title={prospects.length ? `Contactos de Google Maps (${prospects.length})` : 'Cotización de un contacto'} className="mt-4">
      {prospects.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            No están en la plataforma. Copia el número, escríbeles desde el WhatsApp de Chalán y pégales el mensaje.
            Si te mandan su precio, cárgalo con «Agregar su cotización» y el cliente lo ve en sus cotizaciones.
          </p>
          <CopyButton text={serviceMessage(request)} label="Copiar mensaje" />
        </div>
      )}
      {prospects.length > 0 && (
        <ul className="mt-3 divide-y divide-gray-100">
          {prospects.map((p) => (
            <li key={p.phone} className="py-2.5">
              <div className="flex items-start justify-between gap-3">
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
                  {canQuote && quoting !== p.phone && (
                    <button type="button" onClick={() => setQuoting(p.phone)} className="text-xs text-teal-700 hover:underline">
                      Agregar su cotización
                    </button>
                  )}
                </div>
              </div>
              {quoting === p.phone && (
                <ContactQuoteForm request={request} contact={p} onSaved={saved} onCancel={() => setQuoting(null)} />
              )}
            </li>
          ))}
        </ul>
      )}
      {canQuote && (
        <div className={prospects.length ? 'mt-3 border-t border-gray-100 pt-3' : ''}>
          {quoting === 'other'
            ? <ContactQuoteForm request={request} onSaved={saved} onCancel={() => setQuoting(null)} />
            : (
              <button type="button" onClick={() => setQuoting('other')} className="text-xs text-teal-700 hover:underline">
                + Agregar la cotización de otro contacto
              </button>
            )}
        </div>
      )}
    </Card>
  )
}
