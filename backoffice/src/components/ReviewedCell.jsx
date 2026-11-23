// La columna Review de las listas de órdenes y servicios completados: un check
// si el cliente ya dejó su reseña. Sin círculo, para no confundirlo con el
// ícono de "Completada" de la columna Estado.
export default function ReviewedCell({ reviewed }) {
  if (!reviewed) {
    return (
      <span className="text-gray-300" title="El cliente todavía no dejó su reseña">
        —<span className="sr-only">Sin reseña</span>
      </span>
    )
  }
  return (
    <span className="inline-flex text-green-600" title="El cliente ya dejó su reseña">
      <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5 10 17.5 19 7" />
      </svg>
      <span className="sr-only">Con reseña</span>
    </span>
  )
}
