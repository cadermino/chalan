'use client'

import { useState } from 'react'

// Mismo endpoint que backoffice/src/pages/Register.jsx, same-origin vía nginx (/backoffice-api/).
// El blueprint de auth está montado en /auth (no /api/auth) — ver backoffice-api/app/__init__.py.
const REGISTER_URL = '/backoffice-api/auth/register'

interface FormState {
  first_name: string
  last_name: string
  dni: string
  email: string
  phone: string
  password: string
  confirm_password: string
}

const EMPTY_FORM: FormState = {
  first_name: '',
  last_name: '',
  dni: '',
  email: '',
  phone: '',
  password: '',
  confirm_password: '',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--paper)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  padding: '10px 12px',
  fontFamily: 'var(--sans)',
  fontSize: 14,
  color: 'var(--ink-strong)',
  outline: 'none',
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
          phone: form.phone.trim(),
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
      <div style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 14, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--ink-strong)', marginBottom: 8 }}>
          ¡Registro exitoso!
        </h3>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.5 }}>
          Tu cuenta fue creada. Un administrador la activará pronto y te avisaremos
          para que completes el perfil de tu empresa y empieces a cotizar pedidos.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 14, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Nombre">
          <input required value={form.first_name} onChange={set('first_name')} placeholder="Juan" style={inputStyle} />
        </Field>
        <Field label="Apellido">
          <input required value={form.last_name} onChange={set('last_name')} placeholder="Pérez" style={inputStyle} />
        </Field>
      </div>

      <Field label="DNI">
        <input required value={form.dni} onChange={set('dni')} placeholder="12345678" maxLength={15} style={inputStyle} />
      </Field>

      <Field label="Correo electrónico">
        <input type="email" required value={form.email} onChange={set('email')} placeholder="juan@miempresa.pe" style={inputStyle} />
      </Field>

      <Field label="Teléfono / WhatsApp">
        <input type="tel" required value={form.phone} onChange={set('phone')} placeholder="987654321" style={inputStyle} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Contraseña">
          <input type="password" required minLength={8} value={form.password} onChange={set('password')} style={inputStyle} />
        </Field>
        <Field label="Confirmar contraseña">
          <input type="password" required minLength={8} value={form.confirm_password} onChange={set('confirm_password')} style={inputStyle} />
        </Field>
      </div>

      {error && <p style={{ fontSize: 13, color: '#f87171' }}>{error}</p>}

      <button type="submit" disabled={loading} className="btn btn-primary" style={{ justifyContent: 'center', opacity: loading ? 0.6 : 1 }}>
        {loading ? 'Registrando…' : 'Registrar mi empresa'}
      </button>

      <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute)', letterSpacing: '0.04em', textAlign: 'center' }}>
        Al registrarte aceptas que un administrador revise y active tu cuenta antes de que puedas cotizar.
      </p>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mute)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
