// La tarjeta de los detalles (orden, solicitud de servicio): un solo estilo de
// título para que las páginas se lean igual.
export default function Card({ title, className = '', children }) {
  return (
    <section className={`rounded-xl bg-white p-5 shadow ${className}`}>
      {title && <h2 className="mb-3 text-sm font-semibold text-gray-700">{title}</h2>}
      {children}
    </section>
  )
}
