import { useState } from 'react'
import client from '../api/client'

const INPUT = 'w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

const ERRORS = {
  'invalid email': 'Ese correo no es válido.',
  'order already has a customer': 'Esta orden ya tiene cliente. Recarga la página.',
  'duplicated email': 'Justo se creó una cuenta con ese correo. Vuelve a intentar.',
  'one or more fields exceed the maximum allowed length': 'El nombre o el WhatsApp son demasiado largos.',
}

// "Enlazar cliente" en una orden sin cliente: lo que dio por WhatsApp quien
// dejó su número en el paso 1 ("Completar órdenes"). Un correo nuevo crea el
// cliente sin contraseña; uno con cuenta liga la orden a esa cuenta y el número
// queda como el WhatsApp de este pedido. Sin cliente la orden no sale a cotizar.
export default function LinkCustomer({ orderId, leadPhone, onLinked }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: leadPhone || '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-teal-600 px-3 py-1.5 text-sm text-teal-700 hover:bg-teal-50"
      >
        Enlazar cliente
      </button>
    )
  }

  const submit = (event) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    client.post(`/api/orders/${orderId}/customer`, {
      name: form.name.trim(),
      email: form.email.trim(),
      mobile_phone: form.phone.trim(),
    })
      .then(({ data }) => onLinked(data))
      .catch((err) => {
        const message = err.response?.data?.message
        setError(ERRORS[message] || 'No se pudo enlazar. Intenta de nuevo.')
      })
      .finally(() => setSaving(false))
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500">
        Si el correo ya tiene cuenta, la orden queda en esa cuenta y este número como el WhatsApp del pedido. Si
        no, se crea el cliente sin contraseña. No se le manda nada.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Nombre</span>
          <input type="text" value={form.name} required maxLength={255} className={INPUT}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Correo</span>
          <input type="email" value={form.email} required className={INPUT}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">WhatsApp</span>
          <input type="tel" value={form.phone} required maxLength={15} className={INPUT}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-teal-600 px-4 py-1.5 text-sm text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {saving ? 'Enlazando…' : 'Enlazar'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-500">
          Cancelar
        </button>
      </div>
    </form>
  )
}
