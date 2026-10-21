import CopyButton from './CopyButton'

// Nombre · WhatsApp · Copiar número, igual en el detalle de una orden y en el de
// una solicitud de servicio. Se copia el número y no se abre el chat interno: a
// los clientes se les escribe desde el WhatsApp de Chalán en el celular.
export default function ClientContact({ name, phone, emptyText = 'Sin WhatsApp todavía.' }) {
  if (!name && !phone) return <p className="text-sm text-gray-400">{emptyText}</p>

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-gray-900">
      <p>
        {name && <span className="font-medium">{name}</span>}
        {name && ' · '}
        {phone ? `WhatsApp ${phone}` : <span className="text-gray-400">{emptyText}</span>}
      </p>
      {phone && <CopyButton text={phone} label="Copiar número" />}
    </div>
  )
}
