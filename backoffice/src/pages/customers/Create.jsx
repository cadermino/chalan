import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../../api/client'

export default function CustomerCreate() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    email: '',
    mobilePhone: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const { data } = await client.post('/api/customers', {
        name: form.name,
        email: form.email,
        mobile_phone: form.mobilePhone,
      })
      navigate('/customers', {
        state: {
          message: 'Cliente creado. Cuando tenga una orden, mándale el link desde el detalle de la orden ("Copiar link del cliente").',
          customerId: data.customer_id,
        },
      })
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear el cliente')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-md">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/customers" className="text-teal-600 hover:underline text-sm">← Clientes</Link>
        <h1 className="text-2xl font-bold text-gray-900">Crear cliente</h1>
      </div>

      <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4 text-xs text-teal-800">
        El cliente no necesita contraseña: entra a su orden con el link que le
        llega por WhatsApp con cada cotización, o con el que copias desde el
        detalle de la orden.
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-xl shadow p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Nombre completo</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Teléfono</label>
            <input
              type="tel"
              value={form.mobilePhone}
              onChange={e => setForm(f => ({ ...f, mobilePhone: e.target.value }))}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3 justify-end">
          <Link
            to="/customers"
            className="px-5 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Creando...' : 'Crear cliente'}
          </button>
        </div>
      </form>
    </div>
  )
}
