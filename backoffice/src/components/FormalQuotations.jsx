import { useEffect, useState } from 'react'
import client from '../api/client'
import Card from './Card'
import { isValidRuc, normalizeRuc } from '../lib/ruc'

const INPUT = 'w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

const FIELD_ERRORS = {
  ruc: 'El RUC no es válido (11 dígitos, revisa el último).',
  business_name: 'Falta la razón social.',
  contact_email: 'Ese correo no es válido.',
  quotation_id: 'Esa cotización ya no está disponible. Recarga la página.',
}

const money = (value) => `S/ ${Number(value).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function filenameFrom(disposition) {
  const match = /filename="?([^";]+)"?/.exec(disposition || '')
  return match ? match[1] : 'Cotizacion_Chalan.pdf'
}

function download(res) {
  const url = URL.createObjectURL(res.data)
  const link = document.createElement('a')
  link.href = url
  link.download = filenameFrom(res.headers['content-disposition'])
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

// El error de una petición con responseType blob llega como Blob, no como JSON.
async function errorMessage(err) {
  try {
    const body = JSON.parse(await err.response.data.text())
    return FIELD_ERRORS[body.field] || body.message || 'No se pudo generar.'
  } catch {
    return 'No se pudo generar. Vuelve a intentar.'
  }
}

// "Cotización formal": el PDF con RUC, IGV, condiciones y la cuenta BCP para un
// cliente empresa. Lo arma el API principal con los datos de la orden; aquí se
// eligen la cotización, los datos del cliente y dos opciones que el cliente no
// tiene en el paso 3: si el precio ya incluye IGV y si se pide adelanto.
export default function FormalQuotations({ orderId, customerName }) {
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)

  const load = () => client.get(`/api/orders/${orderId}/formal-quotations`)
    .then((res) => setData(res.data))
    .catch(() => setData({ formal_quotations: [], quotations: [], failed: true }))

  useEffect(() => { load() }, [orderId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null
  const quotations = data.quotations || []

  const start = () => {
    const last = data.last_client || {}
    const selected = quotations.find((q) => q.selected) || quotations[0]
    setForm({
      quotation_id: selected ? selected.id : '',
      ruc: last.ruc || '',
      business_name: last.business_name || '',
      contact_name: last.contact_name || customerName || '',
      contact_email: last.contact_email || '',
      prices_include_igv: false,
      include_reservation: Boolean(data.include_reservation_default),
    })
    setError(null)
    setOpen(true)
  }

  const set = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((f) => ({ ...f, [field]: value }))
  }

  const submit = async (event) => {
    event.preventDefault()
    const ruc = normalizeRuc(form.ruc)
    if (!isValidRuc(ruc)) { setError(FIELD_ERRORS.ruc); return }
    if (form.business_name.trim().length < 2) { setError(FIELD_ERRORS.business_name); return }
    setSaving(true)
    setError(null)
    try {
      const res = await client.post(`/api/orders/${orderId}/formal-quotations`, {
        ...form,
        quotation_id: Number(form.quotation_id),
        ruc,
        business_name: form.business_name.trim(),
        contact_name: form.contact_name.trim(),
        contact_email: form.contact_email.trim(),
      }, { responseType: 'blob' })
      download(res)
      setOpen(false)
      load()
    } catch (err) {
      setError(await errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const downloadAgain = async (id) => {
    setDownloadingId(id)
    try {
      download(await client.get(`/api/formal-quotations/${id}/pdf`, { responseType: 'blob' }))
    } catch {
      setError('No se pudo descargar.')
    } finally {
      setDownloadingId(null)
    }
  }

  const chosen = form && quotations.find((q) => String(q.id) === String(form.quotation_id))
  const preview = chosen && (() => {
    const price = Number(chosen.total_amount)
    const total = form.prices_include_igv ? price : Math.round(price * 118) / 100
    return `Total con IGV: ${money(total)}`
  })()

  return (
    <Card title="Cotización formal (RUC)">
      {data.failed && <p className="text-sm text-red-600">No se pudieron cargar.</p>}
      {data.formal_quotations.length > 0 && (
        <ul className="mb-3 divide-y divide-gray-100">
          {data.formal_quotations.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div>
                <p className="text-gray-900">{row.business_name} · RUC {row.ruc}</p>
                <p className="text-xs text-gray-500">
                  {money(row.total)} con IGV · {row.created_by}
                  {row.created_date && ` · ${new Date(`${row.created_date}Z`).toLocaleDateString('es-PE', { dateStyle: 'medium', timeZone: 'America/Lima' })}`}
                  {row.contact_email && ` · ${row.contact_email}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => downloadAgain(row.id)}
                disabled={downloadingId === row.id}
                className="text-sm text-teal-700 hover:underline disabled:opacity-50"
              >
                {downloadingId === row.id ? 'Descargando…' : 'Descargar'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!open && (
        quotations.length > 0
          ? (
            <button
              type="button"
              onClick={start}
              className="rounded-lg border border-teal-600 px-3 py-1.5 text-sm text-teal-700 hover:bg-teal-50"
            >
              Generar cotización formal
            </button>
          )
          : <p className="text-sm text-gray-500">Se puede generar cuando la orden tenga una cotización.</p>
      )}

      {open && form && (
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm">
            <span className="text-gray-700">Cotización</span>
            <select value={form.quotation_id} onChange={set('quotation_id')} className={INPUT}>
              {quotations.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.carrier_company_name || `Empresa`} · {money(q.total_amount)}{q.selected ? ' · elegida' : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-gray-700">RUC</span>
              <input value={form.ruc} onChange={set('ruc')} inputMode="numeric" maxLength={11} className={INPUT} />
            </label>
            <label className="block text-sm">
              <span className="text-gray-700">Razón social</span>
              <input value={form.business_name} onChange={set('business_name')} maxLength={200} className={INPUT} />
            </label>
            <label className="block text-sm">
              <span className="text-gray-700">Contacto</span>
              <input value={form.contact_name} onChange={set('contact_name')} maxLength={120} className={INPUT} />
            </label>
            <label className="block text-sm">
              <span className="text-gray-700">Correo</span>
              <input type="email" value={form.contact_email} onChange={set('contact_email')} maxLength={255} className={INPUT} />
            </label>
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.prices_include_igv} onChange={set('prices_include_igv')} className="mt-0.5" />
            <span>
              El precio ya incluye IGV
              <span className="block text-xs text-gray-500">Sin marcar (lo normal), el 18 % se suma encima del precio de la web.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.include_reservation} onChange={set('include_reservation')} className="mt-0.5" />
            <span>
              Pedir adelanto
              <span className="block text-xs text-gray-500">La reserva de la web; sin marcar, todo se paga al concluir el servicio.</span>
            </span>
          </label>
          {preview && <p className="text-sm font-semibold text-gray-900">{preview}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? 'Generando…' : 'Generar y descargar PDF'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:underline">
              Cancelar
            </button>
          </div>
          <p className="text-xs text-gray-400">No se le envía al cliente: descárgala y mándasela tú.</p>
        </form>
      )}
    </Card>
  )
}
