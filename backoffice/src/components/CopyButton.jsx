import { useState } from 'react'
import toast from 'react-hot-toast'

// El único botón de copiar del backoffice: links para el cliente, para los
// transportistas y mensajes listos para pegar en WhatsApp.
export default function CopyButton({ text, label = 'Copiar link' }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => toast.error('No se pudo copiar. Cópialo a mano.'))
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-lg border border-teal-600 px-3 py-1.5 text-xs text-teal-600 hover:bg-teal-50"
    >
      {copied ? 'Copiado' : label}
    </button>
  )
}

// Una fila "qué es este link" + botón, como el link del cliente o el de reseña.
export function CopyRow({ title, hint, text, label }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
      </div>
      <CopyButton text={text} label={label} />
    </div>
  )
}
