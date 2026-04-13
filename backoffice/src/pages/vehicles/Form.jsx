import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import client from '../../api/client'
import toast from 'react-hot-toast'

const EMPTY = {
  brand: '', model: '', plates: '', size: 'medium', description: '',
  picture: '', weight: '', width: '', height: '', length: '',
  base_address: '', charge_per_kilometer: 0, charge_per_floor: 0,
  driver_fee: 0, loader_fee: 0, loaders_quantity: 1, active: true,
}

export default function VehicleForm() {
  const { companyId, vehicleId } = useParams()
  const isEdit = Boolean(vehicleId)
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isEdit) {
      client.get(`/api/carrier-companies/${companyId}/vehicles/${vehicleId}`).then(({ data }) => {
        const v = data.vehicle
        setForm({ ...v, active: Boolean(v.active) })
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
      toast.error(err.response?.data?.message || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  const back = `/carrier-companies/${companyId}/vehicles`

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to={back} className="text-teal-600 hover:underline text-sm">← Vehículos</Link>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Editar vehículo' : 'Nuevo vehículo'}</h1>
      </div>

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

          <p className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Dimensiones (opcional)</p>

          <Field label="Peso"><input value={form.weight} onChange={set('weight')} className="input" placeholder="ej. 3.5 ton" /></Field>
          <Field label="Ancho"><input value={form.width} onChange={set('width')} className="input" placeholder="ej. 2.4 m" /></Field>
          <Field label="Alto"><input value={form.height} onChange={set('height')} className="input" placeholder="ej. 2.2 m" /></Field>
          <Field label="Largo"><input value={form.length} onChange={set('length')} className="input" placeholder="ej. 5.5 m" /></Field>

          <Field label="URL foto">
            <input value={form.picture} onChange={set('picture')} className="input" placeholder="https://..." />
          </Field>
          <Field label="Estado">
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input type="checkbox" checked={form.active} onChange={set('active')} className="w-4 h-4 accent-teal-600" />
              <span className="text-sm">Activo</span>
            </label>
          </Field>
        </div>

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
    </div>
  )
}

function Field({ label, children, span = 1 }) {
  return (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
