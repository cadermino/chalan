import { Link } from 'react-router-dom'

// Nombre · WhatsApp · Abrir chat, igual en el detalle de una orden y en el de una
// solicitud de servicio. El chat normaliza el número, así que va tal cual.
export default function ClientContact({ name, phone, emptyText = 'Sin WhatsApp todavía.' }) {
  if (!name && !phone) return <p className="text-sm text-gray-400">{emptyText}</p>

  return (
    <p className="text-sm text-gray-900">
      {name && <span className="font-medium">{name}</span>}
      {name && phone && ' · '}
      {phone
        ? (
          <>
            WhatsApp {phone}{' · '}
            <Link to={`/whatsapp/${encodeURIComponent(phone)}`} className="text-teal-600 hover:underline">
              Abrir chat
            </Link>
          </>
        )
        : <span className="text-gray-400"> · {emptyText}</span>}
    </p>
  )
}
