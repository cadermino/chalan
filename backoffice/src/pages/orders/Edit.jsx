import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import client from '../../api/client'

const STATUS_OPTIONS = [
  { value: 1, label: 'Pendiente' },
  { value: 2, label: 'En progreso' },
  { value: 3, label: 'Completado' },
  { value: 4, label: 'Cancelado' },
]

function AddressFields({ title, values, onChange }) {
  const fields = [
    { key: 'street', label: 'Calle' },
    { key: 'neighborhood', label: 'Colonia / Barrio' },
    { key: 'city', label: 'Ciudad' },
    { key: 'state', label: 'Estado / Región' },
    { key: 'floor_number', label: 'Piso' },
  ]
  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      <p className="text-xs font-bold text-teal-600 uppercase tracking-wide">{title}</p>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">{label}</label>
            <input
              type={key === 'floor_number' ? 'number' : 'text'}
              value={values[key] ?? ''}
              onChange={e => onChange(key, key === 'floor_number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function OrderEdit() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    client.get(`/api/orders/${orderId}`).then(({ data }) => {
      const o = data.order
      setForm({
        appointment_date: o.appointment_date ? o.appointment_date.slice(0, 16) : '',
        order_status_id: o.order_status_id,
        approximate_budget: o.approximate_budget ?? '',
        total_kilometers: o.total_kilometers ?? '',
        comments: o.comments ?? '',
        origin: { street: '', neighborhood: '', city: '', state: '', floor_number: '', ...o.origin },
        destination: { street: '', neighborhood: '', city: '', state: '', floor_number: '', ...o.destination },
      })
    }).finally(() => setLoading(false))
  }, [orderId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await client.put(`/api/orders/${orderId}`, {
        ...form,
        appointment_date: form.appointment_date || null,
        approximate_budget: form.approximate_budget === '' ? null : Number(form.approximate_budget),
        total_kilometers: form.total_kilometers === '' ? null : Number(form.total_kilometers),
      })
      navigate(`/orders/${orderId}`)
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-gray-500 p-8">Cargando...</p>
  if (!form) return <p className="text-red-500 p-8">Orden no encontrada</p>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/orders/${orderId}`} className="text-teal-600 hover:underline text-sm">← Orden #{orderId}</Link>
        <h1 className="text-2xl font-bold text-gray-900">Editar orden #{orderId}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-xl shadow p-5 grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Estado</label>
            <select
              value={form.order_status_id}
              onChange={e => setForm(f => ({ ...f, order_status_id: Number(e.target.value) }))}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Fecha de mudanza</label>
            <input
              type="datetime-local"
              value={form.appointment_date}
              onChange={e => setForm(f => ({ ...f, appointment_date: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Presupuesto aproximado</label>
            <input
              type="number"
              value={form.approximate_budget}
              onChange={e => setForm(f => ({ ...f, approximate_budget: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Kilómetros</label>
            <input
              type="number"
              value={form.total_kilometers}
              onChange={e => setForm(f => ({ ...f, total_kilometers: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="col-span-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Comentarios</label>
            <textarea
              value={form.comments}
              onChange={e => setForm(f => ({ ...f, comments: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <AddressFields
          title="Origen"
          values={form.origin}
          onChange={(key, val) => setForm(f => ({ ...f, origin: { ...f.origin, [key]: val } }))}
        />
        <AddressFields
          title="Destino"
          values={form.destination}
          onChange={(key, val) => setForm(f => ({ ...f, destination: { ...f.destination, [key]: val } }))}
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3 justify-end">
          <Link
            to={`/orders/${orderId}`}
            className="px-5 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
