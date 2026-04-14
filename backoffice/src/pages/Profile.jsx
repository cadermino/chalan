import { useState } from 'react'
import client from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import PasswordInput from '../components/PasswordInput'
import toast from 'react-hot-toast'

export default function Profile() {
  const { user, login } = useAuth()
  const [form, setForm] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    dni: user?.dni ?? '',
    password: '',
    confirm_password: '',
  })
  const [loading, setLoading] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password && form.password !== form.confirm_password) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      dni: form.dni.trim(),
    }
    if (form.password) payload.password = form.password

    try {
      const { data } = await client.put('/auth/me', payload)
      localStorage.setItem('bo_user', JSON.stringify(data.user))
      toast.success('Perfil actualizado')
      setForm((f) => ({ ...f, password: '', confirm_password: '' }))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al actualizar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mi perfil</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
        <Field label="Email">
          <input value={user?.email ?? ''} disabled className="input bg-gray-50 text-gray-400 cursor-not-allowed" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Nombre">
            <input value={form.first_name} onChange={set('first_name')} className="input" />
          </Field>
          <Field label="Apellido">
            <input value={form.last_name} onChange={set('last_name')} className="input" />
          </Field>
        </div>

        <Field label="DNI">
          <input value={form.dni} onChange={set('dni')} className="input" maxLength={15} />
        </Field>

        <hr className="border-gray-200" />
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Cambiar contraseña (opcional)</p>

        <Field label="Nueva contraseña">
          <PasswordInput minLength={8} value={form.password} onChange={set('password')} />
        </Field>
        <Field label="Confirmar contraseña">
          <PasswordInput minLength={8} value={form.confirm_password} onChange={set('confirm_password')} />
        </Field>

        <button
          type="submit"
          disabled={loading}
          className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-60"
        >
          {loading ? 'Guardando…' : 'Guardar cambios'}
        </button>
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
