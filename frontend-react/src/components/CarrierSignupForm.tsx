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

type Theme = 'dark' | 'light'

const THEME = {
  dark: {
    container: { background: 'var(--paper-2)', border: '1px solid var(--line)' },
    input: {
      background: 'var(--paper)',
      border: '1px solid var(--line)',
      color: 'var(--ink-strong)',
      fontFamily: 'var(--sans)',
    } as React.CSSProperties,
    label: { fontFamily: 'var(--mono)', color: 'var(--mute)' } as React.CSSProperties,
    heading: { fontFamily: 'var(--serif)', color: 'var(--ink-strong)' } as React.CSSProperties,
    body: { color: 'var(--ink-soft)' } as React.CSSProperties,
    footnote: { fontFamily: 'var(--mono)', color: 'var(--mute)' } as React.CSSProperties,
    buttonClassName: 'btn btn-primary',
    buttonStyle: {} as React.CSSProperties,
  },
  light: {
    container: { background: '#ffffff', border: '1px solid #f3f4f6', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' },
    input: {
      background: '#ffffff',
      border: '1px solid #d1d5db',
      color: '#111827',
      fontFamily: 'inherit',
    } as React.CSSProperties,
    label: { fontFamily: 'inherit', color: '#6b7280', textTransform: 'none', letterSpacing: 'normal', fontSize: 12 } as React.CSSProperties,
    heading: { fontFamily: 'inherit', color: '#111827' } as React.CSSProperties,
    body: { color: '#4b5563' } as React.CSSProperties,
    footnote: { fontFamily: 'inherit', color: '#9ca3af' } as React.CSSProperties,
    buttonClassName: '',
    buttonStyle: { background: '#1e1b4b' } as React.CSSProperties,
  },
} satisfies Record<Theme, {
  container: React.CSSProperties
  input: React.CSSProperties
  label: React.CSSProperties
  heading: React.CSSProperties
  body: React.CSSProperties
  footnote: React.CSSProperties
  buttonClassName: string
  buttonStyle: React.CSSProperties
}>

export function CarrierSignupForm({ theme = 'dark' }: { theme?: Theme }) {
  const t = THEME[theme]
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 14,
    outline: 'none',
    ...t.input,
  }

  if (done) {
    return (
      <div style={{ ...t.container, borderRadius: 14, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
        <h3 style={{ ...t.heading, fontSize: 24, marginBottom: 8 }}>
          ¡Registro exitoso!
        </h3>
        <p style={{ ...t.body, fontSize: 14, lineHeight: 1.5 }}>
          Tu cuenta fue creada. Un administrador la activará pronto y te avisaremos
          para que completes el perfil de tu empresa y empieces a cotizar pedidos.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ ...t.container, borderRadius: 14, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Nombre" labelStyle={t.label}>
          <input required value={form.first_name} onChange={set('first_name')} placeholder="Juan" style={inputStyle} />
        </Field>
        <Field label="Apellido" labelStyle={t.label}>
          <input required value={form.last_name} onChange={set('last_name')} placeholder="Pérez" style={inputStyle} />
        </Field>
      </div>

      <Field label="DNI" labelStyle={t.label}>
        <input required value={form.dni} onChange={set('dni')} placeholder="12345678" maxLength={15} style={inputStyle} />
      </Field>

      <Field label="Correo electrónico" labelStyle={t.label}>
        <input type="email" required value={form.email} onChange={set('email')} placeholder="juan@miempresa.pe" style={inputStyle} />
      </Field>

      <Field label="Teléfono / WhatsApp" labelStyle={t.label}>
        <input type="tel" required value={form.phone} onChange={set('phone')} placeholder="987654321" style={inputStyle} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Contraseña" labelStyle={t.label}>
          <input type="password" required minLength={8} value={form.password} onChange={set('password')} style={inputStyle} />
        </Field>
        <Field label="Confirmar contraseña" labelStyle={t.label}>
          <input type="password" required minLength={8} value={form.confirm_password} onChange={set('confirm_password')} style={inputStyle} />
        </Field>
      </div>

      {error && <p style={{ fontSize: 13, color: '#ef4444' }}>{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className={t.buttonClassName || undefined}
        style={{
          justifyContent: 'center',
          textAlign: 'center',
          opacity: loading ? 0.6 : 1,
          ...(t.buttonClassName ? {} : {
            width: '100%', color: '#fff', border: 'none', borderRadius: 999,
            padding: '12px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }),
          ...t.buttonStyle,
        }}
      >
        {loading ? 'Registrando…' : 'Registrar mi empresa'}
      </button>

      <p style={{ ...t.footnote, fontSize: 11, letterSpacing: '0.04em', textAlign: 'center' }}>
        Al registrarte aceptas que un administrador revise y active tu cuenta antes de que puedas cotizar.
      </p>
    </form>
  )
}

function Field({ label, labelStyle, children }: { label: string; labelStyle: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', ...labelStyle }}>
        {label}
      </label>
      {children}
    </div>
  )
}
