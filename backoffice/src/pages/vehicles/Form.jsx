import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import client from '../../api/client'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import Card from '../../components/Card'
import VehiclePhoto from '../../components/VehiclePhoto'
import { DocumentFile, VehicleCardUpload, deleteDocument, useCarrierDocuments } from '../../components/CarrierDocuments'

// Datos de la tarjeta de identificación vehicular (SUNARP) y de la caja de
// carga. Todos opcionales.
const CARD_FIELDS = [
  'category', 'body_type', 'manufacture_year', 'color', 'passengers',
  'serial_number', 'registry_entry',
  'gross_weight_tons', 'net_weight_tons', 'payload_tons',
  'vehicle_length_m', 'vehicle_width_m', 'vehicle_height_m',
  'cargo_cover', 'box_length_m', 'box_width_m', 'box_height_m',
]

const EMPTY = {
  brand: '', model: '', plates: '', size: 'medium', description: '',
  picture: '', base_address: '', charge_per_kilometer: 0, charge_per_floor: 0,
  driver_fee: 0, loader_fee: 0, loaders_quantity: 1, active: true,
  ...Object.fromEntries(CARD_FIELDS.map((f) => [f, ''])),
}

const BODY_TYPES = [
  ['furgon', 'Furgón'],
  ['baranda', 'Baranda'],
  ['plataforma', 'Plataforma'],
  ['pick_up', 'Pick-up'],
  ['otro', 'Otro'],
]

// Cómo viaja la carga: es lo que ve el cliente. Sale de fotos del camión, no
// de la carrocería de la tarjeta (un furgón inscrito puede tener barandas).
const CARGO_COVERS = [
  ['cerrada', 'Cerrada: caja rígida con techo y puertas'],
  ['toldo', 'Toldo: lona sobre barandas'],
  ['abierta', 'Abierta: barandas o plataforma, sin techo'],
]

// Campos viejos de texto libre, reemplazados por los de la tarjeta. Solo se
// muestran, para copiarlos a mano, y se borran cuando ya nadie los tenga.
const LEGACY_FIELDS = [['weight', 'Peso'], ['width', 'Ancho'], ['height', 'Alto'], ['length', 'Largo']]

const MAX_YEAR = new Date().getFullYear() + 1

export default function VehicleForm() {
  const { companyId, vehicleId } = useParams()
  const isEdit = Boolean(vehicleId)
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  // La tarjeta de este vehículo, al lado de los campos para copiarlos. La
  // sube el transportista con su link (la de su primer vehículo) o un admin aquí.
  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin'
  const showCard = isAdmin && isEdit
  const { documents, error: documentsError, reload: reloadDocuments } = useCarrierDocuments(companyId, showCard)
  const cards = (documents || []).filter((d) => d.doc_type === 'vehicle_card' && d.vehicle_id === Number(vehicleId))

  const removeCard = async (document) => {
    try {
      await deleteDocument(companyId, document.id)
      toast.success('Archivo borrado')
    } catch {
      toast.error('No se pudo borrar el archivo')
    }
    reloadDocuments()
  }

  useEffect(() => {
    if (isEdit) {
      client.get(`/api/carrier-companies/${companyId}/vehicles/${vehicleId}`).then(({ data }) => {
        const v = data.vehicle
        // Con los decimales de la tarjeta (3.490, 5.70), para cotejarla a simple vista.
        const card = Object.fromEntries(CARD_FIELDS.map((f) => {
          if (v[f] == null) return [f, '']
          if (f.endsWith('_tons')) return [f, Number(v[f]).toFixed(3)]
          if (f.endsWith('_m')) return [f, Number(v[f]).toFixed(2)]
          return [f, v[f]]
        }))
        setForm({ ...v, ...card, active: Boolean(v.active) })
      })
    }
  }, [vehicleId])

  const set = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: val }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const payload = {
      ...form,
      charge_per_kilometer: Number(form.charge_per_kilometer),
      charge_per_floor: Number(form.charge_per_floor),
      driver_fee: Number(form.driver_fee),
      loader_fee: Number(form.loader_fee),
      loaders_quantity: Number(form.loaders_quantity),
    }
    // La foto se guarda al subirla (VehiclePhoto), no con este botón.
    delete payload.picture
    try {
      if (isEdit) {
        await client.put(`/api/carrier-companies/${companyId}/vehicles/${vehicleId}`, payload)
        toast.success('Vehículo actualizado')
      } else {
        await client.post(`/api/carrier-companies/${companyId}/vehicles`, payload)
        toast.success('Vehículo creado')
      }
      navigate(`/carrier-companies/${companyId}/vehicles`)
    } catch (err) {
      const message = err.response?.data?.message
      toast.error(message === 'company does not do moves'
        ? 'Esta empresa no hace mudanzas: no puede tener vehículos.'
        : message || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  const back = `/carrier-companies/${companyId}/vehicles`
  const legacy = LEGACY_FIELDS
    .map(([key, label]) => [label, form[key]])
    .filter(([, value]) => value && String(value).trim())

  return (
    <div className={showCard ? 'max-w-6xl' : 'max-w-2xl'}>
      <div className="flex items-center gap-3 mb-6">
        <Link to={back} className="text-teal-600 hover:underline text-sm">← Vehículos</Link>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Editar vehículo' : 'Nuevo vehículo'}</h1>
      </div>

      <div className={showCard ? 'grid gap-6 lg:grid-cols-2 items-start' : ''}>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Marca">
            <input value={form.brand} onChange={set('brand')} className="input" />
          </Field>
          <Field label="Modelo">
            <input value={form.model} onChange={set('model')} className="input" />
          </Field>
          <Field label="Placas">
            <input value={form.plates} onChange={set('plates')} className="input" />
          </Field>
          <Field label="Tamaño">
            <select value={form.size} onChange={set('size')} className="input">
              <option value="small">Pequeño</option>
              <option value="medium">Mediano</option>
              <option value="large">Grande</option>
            </select>
          </Field>
          <Field label="Descripción" span={2}>
            <textarea rows={2} value={form.description} onChange={set('description')} className="input" />
          </Field>
          <Field label="Dirección base" span={2}>
            <input value={form.base_address} onChange={set('base_address')} className="input" />
          </Field>

          <p className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Tarifas (en Soles)</p>

          <Field label="Costo por km">
            <input type="number" min="0" value={form.charge_per_kilometer} onChange={set('charge_per_kilometer')} className="input" />
          </Field>
          <Field label="Costo por piso">
            <input type="number" min="0" value={form.charge_per_floor} onChange={set('charge_per_floor')} className="input" />
          </Field>
          <Field label="Tarifa conductor">
            <input type="number" min="0" value={form.driver_fee} onChange={set('driver_fee')} className="input" />
          </Field>
          <Field label="Tarifa cargador">
            <input type="number" min="0" value={form.loader_fee} onChange={set('loader_fee')} className="input" />
          </Field>
          <Field label="Cant. cargadores">
            <input type="number" min="0" value={form.loaders_quantity} onChange={set('loaders_quantity')} className="input" />
          </Field>

          <div className="col-span-2 pt-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Tarjeta de identificación vehicular (opcional)</p>
            <p className="text-xs text-gray-500 mt-1">Copia los datos tal cual aparecen en la tarjeta SUNARP, en "Datos del Vehículo".</p>
          </div>

          {legacy.length > 0 && (
            <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
              Datos anteriores, en texto libre: {legacy.map(([label, value]) => `${label}: ${value}`).join(' · ')}.
              Reemplázalos con los de la tarjeta.
            </div>
          )}

          <Field label="Carrocería" hint="La de la tarjeta, aunque el camión haya cambiado">
            <select value={form.body_type} onChange={set('body_type')} className="input">
              <option value="">—</option>
              {BODY_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Categoría">
            <select value={form.category} onChange={set('category')} className="input">
              <option value="">—</option>
              <option value="N1">N1</option>
              <option value="N2">N2</option>
              <option value="N3">N3</option>
            </select>
          </Field>
          <Field label="Año de fabricación">
            <input type="number" min="1950" max={MAX_YEAR} step="1" value={form.manufacture_year} onChange={set('manufacture_year')} className="input" placeholder="ej. 1992" />
          </Field>
          <Field label="Color">
            <input value={form.color} onChange={set('color')} maxLength={30} className="input" placeholder="ej. Blanco" />
          </Field>
          <Field label="Pasajeros">
            <input type="number" min="0" max="20" step="1" value={form.passengers} onChange={set('passengers')} className="input" />
          </Field>
          <Field label="Partida registral">
            <input value={form.registry_entry} onChange={set('registry_entry')} maxLength={20} className="input" />
          </Field>
          <Field label="N° de serie / VIN" span={2}>
            <input value={form.serial_number} onChange={set('serial_number')} maxLength={30} className="input" />
          </Field>

          <Field label="Peso bruto (t)" hint="P. Bruto">
            <input type="number" min="0.001" max="60" step="0.001" value={form.gross_weight_tons} onChange={set('gross_weight_tons')} className="input" placeholder="ej. 3.490" />
          </Field>
          <Field label="Peso neto (t)" hint="P. Neto">
            <input type="number" min="0.001" max="60" step="0.001" value={form.net_weight_tons} onChange={set('net_weight_tons')} className="input" placeholder="ej. 2.390" />
          </Field>
          <Field label="Carga útil (t)" hint="Lo que puede cargar: es lo que ve el cliente. 1.100 t = 1,100 kg" span={2}>
            <input type="number" min="0.001" max="60" step="0.001" value={form.payload_tons} onChange={set('payload_tons')} className="input" placeholder="ej. 1.100" />
          </Field>

          <Field label="Longitud del vehículo (m)">
            <input type="number" min="0.01" max="25" step="0.01" value={form.vehicle_length_m} onChange={set('vehicle_length_m')} className="input" placeholder="ej. 5.70" />
          </Field>
          <Field label="Ancho del vehículo (m)">
            <input type="number" min="0.01" max="25" step="0.01" value={form.vehicle_width_m} onChange={set('vehicle_width_m')} className="input" placeholder="ej. 1.93" />
          </Field>
          <Field label="Altura del vehículo (m)">
            <input type="number" min="0.01" max="25" step="0.01" value={form.vehicle_height_m} onChange={set('vehicle_height_m')} className="input" placeholder="ej. 2.80" />
          </Field>

          <div className="col-span-2 pt-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Caja de carga (opcional)</p>
            <p className="text-xs text-gray-500 mt-1">No está en la tarjeta: míralo en fotos del camión o pregúntaselo al transportista. Las medidas van por dentro de la caja.</p>
          </div>

          <Field label="Cómo viaja la carga" hint="Es lo que ve el cliente en la cotización" span={2}>
            <select value={form.cargo_cover} onChange={set('cargo_cover')} className="input">
              <option value="">—</option>
              {CARGO_COVERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>

          <Field label="Largo de la caja (m)">
            <input type="number" min="0.01" max="25" step="0.01" value={form.box_length_m} onChange={set('box_length_m')} className="input" placeholder="ej. 3.20" />
          </Field>
          <Field label="Ancho de la caja (m)">
            <input type="number" min="0.01" max="25" step="0.01" value={form.box_width_m} onChange={set('box_width_m')} className="input" placeholder="ej. 1.80" />
          </Field>
          <Field label="Alto de la caja (m)">
            <input type="number" min="0.01" max="25" step="0.01" value={form.box_height_m} onChange={set('box_height_m')} className="input" placeholder="ej. 1.90" />
          </Field>

          {isEdit && (
            <Field label="Foto" span={2}>
              <VehiclePhoto
                companyId={companyId}
                vehicleId={vehicleId}
                picture={form.picture}
                onChange={(picture) => setForm((f) => ({ ...f, picture }))}
              />
            </Field>
          )}
          <Field label="Estado">
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input type="checkbox" checked={form.active} onChange={set('active')} className="w-4 h-4 accent-teal-600" />
              <span className="text-sm">Activo</span>
            </label>
          </Field>
        </div>

        {!isEdit && (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            {isAdmin ? 'La foto y la tarjeta de propiedad se suben' : 'La foto se sube'} después de guardar: entra a editar el vehículo desde la lista.
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-60"
          >
            {loading ? 'Guardando…' : 'Guardar'}
          </button>
          <Link to={back} className="text-sm text-gray-500 hover:underline self-center">Cancelar</Link>
        </div>
      </form>

      {showCard && (
        <Card title="Tarjeta de propiedad" className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          {documents === null && <p className="text-sm text-gray-400">Cargando…</p>}
          {documentsError && <p className="text-sm text-red-600">No se pudo cargar la tarjeta.</p>}
          {documents && !documentsError && (
            <div className="space-y-4">
              {cards.length === 0
                ? <p className="text-sm text-gray-500">Este vehículo todavía no tiene tarjeta.</p>
                : cards.map((d, i) => <DocumentFile key={d.id} document={d} index={i} onDelete={() => removeCard(d)} />)}
              <VehicleCardUpload companyId={companyId} vehicleId={vehicleId} count={cards.length} onDone={reloadDocuments} />
            </div>
          )}
        </Card>
      )}
      </div>
    </div>
  )
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
