'use client'

import { useState } from 'react'

// Mismo endpoint que backoffice/src/pages/Register.jsx, same-origin vía nginx (/backoffice-api/).
const REGISTER_URL = '/backoffice-api/api/auth/register'

interface FormState {
  first_name: string
  last_name: string
  dni: string
  email: string
  password: string
  confirm_password: string
}

const EMPTY_FORM: FormState = {
  first_name: '',
  last_name: '',
  dni: '',
  email: '',
  password: '',
  confirm_password: '',
}

export function CarrierSignupForm() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (form.password !== form.confirm_password) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(REGISTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          dni: form.dni.trim(),
          email: form.email.trim(),
          password: form.password,
          role: 'carrier_company',
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.message || 'Ocurrió un error al registrarte. Inténtalo de nuevo.')
        return
      }

      setDone(true)
    } catch {
      setError('No pudimos conectar con el servidor. Inténtalo de nuevo en un momento.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center">
        <div className="text-4xl mb-4">✅</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">¡Registro exitoso!</h3>
        <p className="text-gray-600">
          Tu cuenta fue creada. Un administrador la activará pronto y te avisaremos
          para que completes el perfil de tu empresa y empieces a cotizar pedidos.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 sm:p-8 shadow-sm border border-gray-100 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nombre">
          <input
            required
            value={form.first_name}
            onChange={set('first_name')}
            placeholder="Juan"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </Field>
        <Field label="Apellido">
          <input
            required
            value={form.last_name}
            onChange={set('last_name')}
            placeholder="Pérez"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </Field>

      <Field label="Correo electrónico">
        <input
          type="email"
          required
          value={form.email}
          onChange={set('email')}
          placeholder="juan@miempresa.pe"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Contraseña">
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={set('password')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </Field>
        <Field label="Confirmar contraseña">
          <input
            type="password"
            required
            minLength={8}
            value={form.confirm_password}
            onChange={set('confirm_password')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </Field>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-950 hover:bg-indigo-900 text-white font-semibold py-3 rounded-full text-sm transition-colors disabled:opacity-60"
      >
        {loading ? 'Registrando…' : 'Registrar mi empresa'}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Al registrarte aceptas que un administrador revise y active tu cuenta antes de que puedas cotizar.
      </p>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
