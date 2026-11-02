import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import client from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import PasswordInput from '../components/PasswordInput'

const MIN_LENGTH = 8

// Por qué el link ya no sirve, según el `reason` del API.
const LINK_PROBLEMS = {
  expired: 'Este link ya venció.',
  used: 'Este link ya se usó: la contraseña ya se cambió con él.',
  invalid: 'Este link no es válido.',
}

// La abre el link del correo o el que manda un admin por WhatsApp. Al guardar,
// entra directo con la sesión que devuelve el API.
export default function ResetPassword() {
  const { token } = useParams()
  const { startSession } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ password: '', repeat: '' })
  const [error, setError] = useState(null)
  const [linkProblem, setLinkProblem] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (form.password.length < MIN_LENGTH) {
      setError(`La contraseña tiene que tener al menos ${MIN_LENGTH} caracteres.`)
      return
    }
    if (form.password !== form.repeat) {
      setError('Las dos contraseñas no son iguales.')
      return
    }
    setLoading(true)
    try {
      const { data } = await client.post('/auth/password-reset/confirm', { token, password: form.password })
      startSession(data)
      navigate('/')
    } catch (err) {
      if (err.response?.status === 401) setLinkProblem(LINK_PROBLEMS[err.response.data?.reason] || LINK_PROBLEMS.invalid)
      else if (err.response?.status === 400) setError(`La contraseña tiene que tener al menos ${MIN_LENGTH} caracteres.`)
      else setError('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Chalán</h1>
          <p className="text-sm text-gray-500 mt-1">Crea tu contraseña nueva</p>
        </div>

        {linkProblem ? (
          <div className="space-y-4 text-sm text-gray-700">
            <p>{linkProblem}</p>
            <Link to="/recuperar" className="inline-block text-teal-600 hover:underline">Pedir un link nuevo</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña nueva</label>
              <PasswordInput
                required
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-gray-400">Al menos {MIN_LENGTH} caracteres.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repítela</label>
              <PasswordInput
                required
                autoComplete="new-password"
                value={form.repeat}
                onChange={(e) => setForm({ ...form, repeat: e.target.value })}
                className={inputClass}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-60"
            >
              {loading ? 'Guardando…' : 'Guardar y entrar'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
