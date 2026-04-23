import { useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import PasswordInput from '../components/PasswordInput'
import toast from 'react-hot-toast'

export default function Register() {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    dni: '',
    email: '',
    password: '',
    confirm_password: '',
    role: 'carrier_company',
  })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm_password) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    try {
      await client.post('/auth/register', {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        dni: form.dni.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      })
      setDone(true)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">¡Registro exitoso!</h2>
          <p className="text-sm text-gray-500 mb-6">
            Tu cuenta fue creada. Un administrador la activará pronto y recibirás acceso al backoffice.
          </p>
          <Link to="/login" className="text-teal-600 hover:underline text-sm">
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Chalán</h1>
          <p className="text-sm text-gray-500 mt-1">Crea tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Tipo de cuenta">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  value="carrier_company"
                  checked={form.role === 'carrier_company'}
                  onChange={set('role')}
                  className="accent-teal-600"
                />
                Empresa de mudanza
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  value="real_estate_agent"
                  checked={form.role === 'real_estate_agent'}
                  onChange={set('role')}
                  className="accent-teal-600"
                />
                Agente inmobiliario
              </label>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre">
              <input
                required
                value={form.first_name}
                onChange={set('first_name')}
                placeholder="Juan"
                className="input"
              />
            </Field>
            <Field label="Apellido">
              <input
                required
                value={form.last_name}
                onChange={set('last_name')}
                placeholder="Pérez"
                className="input"
              />
            </Field>
          </div>

          <Field label="DNI">
            <input
              required
              value={form.dni}
              onChange={set('dni')}
              placeholder="12345678"
              maxLength={15}
              className="input"
            />
          </Field>

          <Field label="Correo electrónico">
            <input
              type="email"
              required
              value={form.email}
              onChange={set('email')}
              placeholder="juan@empresa.pe"
              className="input"
            />
          </Field>

          <Field label="Contraseña">
            <PasswordInput
              required
              minLength={8}
              value={form.password}
              onChange={set('password')}
            />
          </Field>

          <Field label="Confirmar contraseña">
            <PasswordInput
              required
              minLength={8}
              value={form.confirm_password}
              onChange={set('confirm_password')}
            />
          </Field>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-60 mt-2"
          >
            {loading ? 'Registrando…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-teal-600 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
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
