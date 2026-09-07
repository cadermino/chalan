import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../../api/client'

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 12; i += 1) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export default function CustomerCreate() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    email: '',
    mobilePhone: '',
    password: generatePassword(),
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
        password: form.password,
      })
      navigate('/customers', {
        state: {
          message: `Cliente creado. Contraseña: ${form.password} — copiala antes de salir, no se puede volver a ver.`,
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

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800">
        No hay recuperación de contraseña en el sitio todavía — anotá la que
        se genera abajo y pasásela al cliente vos mismo (llamada, WhatsApp).
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
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Contraseña</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, password: generatePassword() }))}
                className="px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Regenerar
              </button>
            </div>
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
