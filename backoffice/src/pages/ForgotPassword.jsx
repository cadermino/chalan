import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import client from '../api/client'

// Pide el link por correo. La respuesta es la misma haya o no cuenta con ese
// correo (el API no lo dice), así que la pantalla tampoco.
export default function ForgotPassword() {
  const location = useLocation()
  const [email, setEmail] = useState(location.state?.email || '')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await client.post('/auth/password-reset', { email })
      setSent(true)
    } catch {
      setError('No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Chalán</h1>
          <p className="text-sm text-gray-500 mt-1">Crea una contraseña nueva</p>
        </div>

        {sent ? (
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              Si hay una cuenta con <span className="font-medium">{email}</span>, te mandamos un correo con un link
              para crear tu contraseña nueva. Sirve por 1 hora.
            </p>
            <p className="text-gray-500">¿No te llegó? Revisa la carpeta de spam, o escríbenos por WhatsApp y te mandamos el link por ahí.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email de tu cuenta</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 rounded-lg text-sm transition-colors disabled:opacity-60"
            >
              {loading ? 'Enviando…' : 'Mandarme el link'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link to="/login" className="text-teal-600 hover:underline">← Volver a ingresar</Link>
        </p>
      </div>
    </div>
  )
}
