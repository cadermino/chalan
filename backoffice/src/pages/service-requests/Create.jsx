import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import client from '../../api/client'

const MAX_ADVANCE_DAYS = 90

// 'YYYY-MM-DD' de hoy en Lima, y sumando días sin pasar por new Date('YYYY-MM-DD')
// (que se lee como UTC y en Lima daría el día anterior).
function limaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())
}
function addDays(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

let itemSeq = 0
const newItem = () => ({ key: `item-${++itemSeq}`, description: '', quantity: 1, materials: [] })

// El API principal responde en inglés, pensado para quien programa; acá se avisa
// qué falta con las palabras del formulario.
function friendlyError(message) {
  if (!message) return 'Error al crear la solicitud'
  if (message.includes('map_url')) return 'Falta el link de Google Maps de la dirección (tiene que empezar con https://).'
  if (message.includes('neighborhood')) return 'Falta el distrito.'
  if (message.includes('address.street')) return 'Falta la dirección.'
  if (message.includes('whatsapp')) return 'El WhatsApp del cliente no es válido.'
  if (message.includes('preferred_date')) return `La fecha tiene que ser desde hoy y hasta dentro de ${MAX_ADVANCE_DAYS} días.`
  if (message.includes('at least one item') || message.includes('items')) return 'Agrega al menos una cosa para embalar, con su descripción.'
  return message
}

function Field({ label, hint, children, span = 1 }) {
  return (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

export default function ServiceRequestCreate() {
  const navigate = useNavigate()
  const today = limaToday()

  const [serviceTypes, setServiceTypes] = useState([])
  const [serviceCode, setServiceCode] = useState('')
  const [materials, setMaterials] = useState([])
  const [form, setForm] = useState({
    whatsapp: '', street: '', interior: '', neighborhood: '', city: 'Lima', mapUrl: '',
    preferredDate: '', notifyCarriers: true,
  })
  const [items, setItems] = useState([newItem()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    client.get('/api/service-types').then(({ data }) => {
      setServiceTypes(data.service_types)
      if (data.service_types.length === 1) setServiceCode(data.service_types[0].code)
    })
  }, [])

  // Los materiales salen del catálogo: agregar uno nuevo no pide tocar este formulario.
  useEffect(() => {
    if (!serviceCode) return
    client.get(`/api/service-types/${serviceCode}/materials`).then(({ data }) => setMaterials(data.materials))
  }, [serviceCode])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const updateItem = (key, fields) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...fields } : i)))
  const toggleMaterial = (item, code) => updateItem(item.key, {
    materials: item.materials.includes(code) ? item.materials.filter((c) => c !== code) : [...item.materials, code],
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const filled = items.filter((i) => i.description.trim())
    if (!serviceCode) return setError('Elige el servicio.')
    if (filled.length === 0) return setError('Agrega al menos una cosa para embalar, con su descripción.')

    setSaving(true)
    try {
      const { data } = await client.post('/api/service-requests', {
        service_type: serviceCode,
        whatsapp: form.whatsapp,
        preferred_date: form.preferredDate,
        address: {
          street: form.street,
          interior: form.interior,
          neighborhood: form.neighborhood,
          city: form.city,
          country: 'PE',
          map_url: form.mapUrl,
        },
        items: filled.map(({ description, quantity, materials: codes }) => ({ description, quantity, materials: codes })),
        notify_carriers: form.notifyCarriers,
      })
      toast.success(data.notified_carrier_ids.length
        ? `Solicitud creada. Avisamos a ${data.notified_carrier_ids.length} transportista(s)`
        : 'Solicitud creada')
      navigate(`/service-requests/${data.id}`)
    } catch (err) {
      setError(friendlyError(err.response?.data?.message))
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/service-requests" className="text-teal-600 hover:underline text-sm">← Embalajes</Link>
        <h1 className="text-2xl font-bold text-gray-900">Nueva solicitud</h1>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Para pedidos que el cliente describió por WhatsApp o llamada. Queda como enviada y se avisa a los transportistas.
      </p>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-6">
        {error && <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

        {serviceTypes.length > 1 && (
          <Field label="Servicio *">
            <select required value={serviceCode} onChange={(e) => setServiceCode(e.target.value)} className="input">
              <option value="">Elige…</option>
              {serviceTypes.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="WhatsApp del cliente *" hint="9 dígitos; se guarda con +51. Con este número se enlaza al cliente.">
            <input required inputMode="numeric" placeholder="987654321" value={form.whatsapp} onChange={set('whatsapp')} className="input" />
          </Field>
          <Field label="Fecha deseada *" hint="Se puede pedir para hoy.">
            <input
              required type="date" min={today} max={addDays(today, MAX_ADVANCE_DAYS)}
              value={form.preferredDate} onChange={set('preferredDate')} className="input"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Dirección *" span={2}>
            <input required maxLength={200} placeholder="Av. Javier Prado Este 123" value={form.street} onChange={set('street')} className="input" />
          </Field>
          <Field label="Distrito *">
            <input required maxLength={100} placeholder="San Isidro" value={form.neighborhood} onChange={set('neighborhood')} className="input" />
          </Field>
          <Field label="Ciudad">
            <input maxLength={100} value={form.city} onChange={set('city')} className="input" />
          </Field>
          <Field label="Dpto, interior o referencia" span={2}>
            <input maxLength={100} placeholder="Dpto 402, torre B" value={form.interior} onChange={set('interior')} className="input" />
          </Field>
          <Field
            label="Link de Google Maps *" span={2}
            hint="En Google Maps: Compartir → Copiar enlace. Los transportistas lo usan para ubicar la dirección."
          >
            <input
              required type="url" maxLength={400} placeholder="https://maps.app.goo.gl/…"
              value={form.mapUrl} onChange={set('mapUrl')} className="input"
            />
          </Field>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-1">Qué hay que embalar</h2>
          <p className="text-xs text-gray-400 mb-3">Sin materiales marcados significa "que el transportista recomiende".</p>
          <ul className="space-y-3">
            {items.map((item, index) => (
              <li key={item.key} className="rounded-lg border border-gray-200 p-3">
                <div className="flex gap-2">
                  <input
                    aria-label={`Cosa ${index + 1}`} maxLength={200} placeholder="Ej. Sofá de 3 cuerpos"
                    value={item.description} onChange={(e) => updateItem(item.key, { description: e.target.value })}
                    className="input flex-1"
                  />
                  <input
                    aria-label="Cantidad" type="number" min={1} max={999}
                    value={item.quantity}
                    onChange={(e) => updateItem(item.key, { quantity: Math.max(1, Math.min(999, Number(e.target.value) || 1)) })}
                    className="input !w-20"
                  />
                  <button
                    type="button" aria-label="Quitar"
                    onClick={() => setItems((list) => list.filter((i) => i.key !== item.key))}
                    className="text-gray-400 hover:text-red-600 px-2"
                  >
                    ×
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {materials.map((m) => {
                    const checked = item.materials.includes(m.code)
                    return (
                      <label
                        key={m.code} title={m.description}
                        className={`cursor-pointer select-none rounded-full border px-3 py-1 text-xs ${
                          checked ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-gray-300 text-gray-500 hover:border-gray-400'
                        }`}
                      >
                        <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleMaterial(item, m.code)} />
                        {checked ? '✓ ' : ''}{m.name}
                      </label>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button" disabled={items.length >= 50}
            onClick={() => setItems((list) => [...list, newItem()])}
            className="mt-3 text-sm text-teal-600 hover:underline"
          >
            + Agregar otra cosa
          </button>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.notifyCarriers} onChange={set('notifyCarriers')} className="w-4 h-4 accent-teal-600" />
          <span className="text-sm">Avisar a los transportistas al crear</span>
        </label>
        {!form.notifyCarriers && (
          <p className="text-xs text-gray-400 -mt-4">Podrás revisarla y enviarla después con "Reenviar a transportistas" en el detalle.</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit" disabled={saving}
            className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-60"
          >
            {saving ? 'Creando…' : 'Crear solicitud'}
          </button>
          <Link to="/service-requests" className="text-sm text-gray-500 hover:underline self-center">Cancelar</Link>
        </div>
      </form>
    </div>
  )
}
