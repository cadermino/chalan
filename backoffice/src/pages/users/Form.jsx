import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import client from '../../api/client'
import PasswordInput from '../../components/PasswordInput'
import toast from 'react-hot-toast'

const ROLES = ['superadmin', 'admin', 'carrier_company']

export default function UserForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [companies, setCompanies] = useState([])
  const [form, setForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    dni: '',
    role: 'admin',
    carrier_company_id: '',
    active: true,
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    client.get('/api/carrier-companies').then(({ data }) => setCompanies(data.carrier_companies))
    if (isEdit) {
      client.get(`/api/users/${id}`).then(({ data }) => {
        const u = data.user
        setForm({
          email: u.email,
          password: '',
          first_name: u.first_name ?? '',
          last_name: u.last_name ?? '',
          dni: u.dni ?? '',
          role: u.role,
          carrier_company_id: u.carrier_company_id ?? '',
          active: u.active,
        })
      })
    }
  }, [id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        ...form,
        carrier_company_id: form.carrier_company_id ? Number(form.carrier_company_id) : null,
      }
      if (isEdit) {
        await client.put(`/api/users/${id}`, payload)
        toast.success('Usuario actualizado')
      } else {
        await client.post('/api/users', payload)
        toast.success('Usuario creado')
      }
      navigate('/users')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/users" className="text-teal-600 hover:underline text-sm">← Usuarios</Link>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
        <Field label="Email">
          <input
            type="email"
            required={!isEdit}
            value={form.email}
            disabled={isEdit}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="input"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Nombre">
            <input
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Apellido">
            <input
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              className="input"
            />
          </Field>
        </div>

        <Field label="DNI">
          <input
            value={form.dni}
            onChange={(e) => setForm({ ...form, dni: e.target.value })}
            className="input"
          />
        </Field>

        <Field label={isEdit ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}>
          <PasswordInput
            required={!isEdit}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>

        <Field label="Rol">
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="input"
          >
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>

        {form.role === 'carrier_company' && (
          <Field label="Empresa transportista">
            <select
              value={form.carrier_company_id}
              onChange={(e) => setForm({ ...form, carrier_company_id: e.target.value })}
              className="input"
            >
              <option value="">— Crear empresa nueva automáticamente —</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {!form.carrier_company_id && !isEdit && (
              <p className="text-xs text-gray-400 mt-1">Se creará una empresa y un vehículo en blanco vinculados a este usuario.</p>
            )}
          </Field>
        )}

        {isEdit && (
          <Field label="Estado">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="w-4 h-4 accent-teal-600"
              />
              <span className="text-sm">Activo</span>
            </label>
          </Field>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-60"
          >
            {loading ? 'Guardando…' : 'Guardar'}
          </button>
          <Link to="/users" className="text-sm text-gray-500 hover:underline self-center">Cancelar</Link>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
