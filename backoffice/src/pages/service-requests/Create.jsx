import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import client from '../../api/client'
import { PAINTING_LABELS } from '../../components/ServiceRequestView'

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
const newItem = () => ({ key: `item-${++itemSeq}`, description: '', quantity: 1, materials: [], work: '', pack: false })

const WORKS = [
  { code: 'assemble', label: 'Armar' },
  { code: 'disassemble', label: 'Desarmar' },
  { code: 'both', label: 'Desarmar y armar' },
]
const EMPTY_DESTINATION = { street: '', interior: '', neighborhood: '', city: 'Lima', mapUrl: '' }

// El API principal responde en inglés, pensado para quien programa; acá se avisa
// qué falta con las palabras del formulario.
function friendlyError(message) {
  if (!message) return 'Error al crear el servicio'
  if (message.includes('destination.map_url')) return 'Falta el link de Google Maps del destino (tiene que empezar con https://).'
  if (message.includes('destination.neighborhood')) return 'Falta el distrito del destino.'
  if (message.includes('destination')) return 'Falta la dirección de destino: algún mueble se desarma y se arma en otro lado.'
  if (message.includes('.work')) return 'Elige qué hacer con cada mueble.'
  if (message.includes('map_url')) return 'Falta el link de Google Maps de la dirección (tiene que empezar con https://).'
  if (message.includes('neighborhood')) return 'Falta el distrito.'
  if (message.includes('address.street')) return 'Falta la dirección.'
  if (message.includes('whatsapp')) return 'El WhatsApp del cliente no es válido.'
  if (message.includes('preferred_date')) return `La fecha tiene que ser desde hoy y hasta dentro de ${MAX_ADVANCE_DAYS} días.`
  if (message.includes('at least one item') || message.includes('items')) return 'Agrega al menos una cosa a la lista, con su descripción.'
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
  const [destination, setDestination] = useState(EMPTY_DESTINATION)
  // Pintura no tiene lista: qué pintar y las respuestas rápidas (todas opcionales).
  const [painting, setPainting] = useState({ description: '', area: '', size: '', area_m2: '', paint_by: '', wall_issues: [] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    client.get('/api/service-types').then(({ data }) => {
      // Solo los que se piden con este formulario: la mudanza está en el catálogo
      // como servicio de las empresas, pero se pide por el flujo de órdenes.
      const requestable = data.service_types.filter((t) => t.requestable)
      setServiceTypes(requestable)
      if (requestable.length === 1) setServiceCode(requestable[0].code)
    })
  }, [])

  // Los materiales salen del catálogo: agregar uno nuevo no pide tocar este formulario.
  useEffect(() => {
    if (!serviceCode) return
    client.get(`/api/service-types/${serviceCode}/materials`).then(({ data }) => setMaterials(data.materials))
  }, [serviceCode])

  // Armado de muebles: qué hacer con cada mueble, si se embala (con los
  // materiales de embalaje) y, si alguno se arma en otro lado, el destino.
  const isAssembly = serviceCode === 'furniture_assembly'
  const isPainting = serviceCode === 'painting'
  const setPaint = (key) => (e) => setPainting((p) => ({ ...p, [key]: e.target.value }))
  const toggleIssue = (code) => setPainting((p) => ({
    ...p,
    wall_issues: p.wall_issues.includes(code) ? p.wall_issues.filter((c) => c !== code) : [...p.wall_issues, code],
  }))
  const needsDestination = isAssembly && items.some((i) => i.work === 'both')
  const setDest = (key) => (e) => setDestination((d) => ({ ...d, [key]: e.target.value }))

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
    // Acá no se suben videos: en pintura la descripción es obligatoria.
    if (isPainting && !painting.description.trim()) return setError('Cuenta qué hay que pintar.')
    if (!isPainting && filled.length === 0) return setError('Agrega al menos una cosa a la lista, con su descripción.')
    if (isAssembly && filled.some((i) => !i.work)) return setError('Elige qué hacer con cada mueble.')

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
        ...(!isPainting && {
          items: filled.map(({ description, quantity, materials: codes, work, pack }) => (isAssembly
            ? { description, quantity, materials: pack ? codes : [], work, pack }
            : { description, quantity, materials: codes })),
        }),
        ...(isPainting && {
          details: {
            description: painting.description,
            area: painting.area || null,
            size: painting.size || null,
            paint_by: painting.paint_by || null,
            area_m2: Number(painting.area_m2) > 0 ? Number(painting.area_m2) : null,
            wall_issues: painting.wall_issues,
          },
        }),
        ...(needsDestination && {
          details: {
            destination: {
              street: destination.street,
              interior: destination.interior,
              neighborhood: destination.neighborhood,
              city: destination.city,
              country: 'PE',
              map_url: destination.mapUrl,
            },
          },
        }),
        notify_carriers: form.notifyCarriers,
      })
      toast.success(data.notified_carrier_ids.length
        ? `Servicio creado. Avisamos a ${data.notified_carrier_ids.length} transportista(s)`
        : 'Servicio creado')
      navigate(`/service-requests/${data.id}`)
    } catch (err) {
      setError(friendlyError(err.response?.data?.message))
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/service-requests" className="text-teal-600 hover:underline text-sm">← Servicios</Link>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo servicio</h1>
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

        {isPainting && (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Qué hay que pintar</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Descripción *" span={2} hint="Lo que contó el cliente: ambientes, paredes o techo, colores.">
                <textarea
                  required rows={4} maxLength={2000} value={painting.description}
                  onChange={setPaint('description')} className="input"
                  placeholder="Ej. Sala, comedor y 2 dormitorios, paredes y techo. Blanco humo."
                />
              </Field>
              {[['area', 'Dónde'], ['size', 'Cuánto'], ['paint_by', 'Pintura']].map(([key, label]) => (
                <Field key={key} label={label}>
                  <select value={painting[key]} onChange={setPaint(key)} className="input">
                    <option value="">No dijo</option>
                    {Object.entries(PAINTING_LABELS[key]).map(([code, text]) => <option key={code} value={code}>{text}</option>)}
                  </select>
                </Field>
              ))}
              <Field label="Metros de pared">
                <input
                  type="number" min={1} max={5000} value={painting.area_m2}
                  onChange={setPaint('area_m2')} className="input" placeholder="Ej. 60"
                />
              </Field>
              <Field label="Paredes" span={2}>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(PAINTING_LABELS.wall_issues).map(([code, text]) => {
                    const checked = painting.wall_issues.includes(code)
                    return (
                      <label
                        key={code}
                        className={`cursor-pointer select-none rounded-full border px-3 py-1 text-xs ${
                          checked ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-gray-300 text-gray-500 hover:border-gray-400'
                        }`}
                      >
                        <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleIssue(code)} />
                        {checked ? '✓ ' : ''}{text}
                      </label>
                    )
                  })}
                </div>
              </Field>
            </div>
          </div>
        )}

        {!isPainting && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-1">
            {isAssembly ? 'Muebles' : 'Qué hay que embalar'}
          </h2>
          <p className="text-xs text-gray-400 mb-3">
            {isAssembly
              ? 'Si se embala sin materiales marcados, el armador recomienda.'
              : 'Sin materiales marcados significa "que el transportista recomiende".'}
          </p>
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
                {isAssembly && (
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <select
                      aria-label="Qué hacer" value={item.work}
                      onChange={(e) => updateItem(item.key, { work: e.target.value })}
                      className="input !w-48"
                    >
                      <option value="">Qué hacer…</option>
                      {WORKS.map((w) => <option key={w.code} value={w.code}>{w.label}</option>)}
                    </select>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox" checked={item.pack} className="w-4 h-4 accent-teal-600"
                        onChange={(e) => updateItem(item.key, { pack: e.target.checked, materials: [] })}
                      />
                      También embalarlo
                    </label>
                  </div>
                )}
                <div className={`flex flex-wrap gap-2 mt-2 ${isAssembly && !item.pack ? 'hidden' : ''}`}>
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
        )}

        {needsDestination && (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-1">Destino (dónde se arman)</h2>
            <p className="text-xs text-gray-400 mb-3">Algún mueble se desarma en la dirección de arriba y se arma acá.</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Dirección *" span={2}>
                <input required maxLength={200} value={destination.street} onChange={setDest('street')} className="input" />
              </Field>
              <Field label="Distrito *">
                <input required maxLength={100} value={destination.neighborhood} onChange={setDest('neighborhood')} className="input" />
              </Field>
              <Field label="Ciudad">
                <input maxLength={100} value={destination.city} onChange={setDest('city')} className="input" />
              </Field>
              <Field label="Dpto, interior o referencia" span={2}>
                <input maxLength={100} value={destination.interior} onChange={setDest('interior')} className="input" />
              </Field>
              <Field label="Link de Google Maps *" span={2}>
                <input
                  required type="url" maxLength={400} placeholder="https://maps.app.goo.gl/…"
                  value={destination.mapUrl} onChange={setDest('mapUrl')} className="input"
                />
              </Field>
            </div>
          </div>
        )}

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
            {saving ? 'Creando…' : 'Crear servicio'}
          </button>
          <Link to="/service-requests" className="text-sm text-gray-500 hover:underline self-center">Cancelar</Link>
        </div>
      </form>
    </div>
  )
}
