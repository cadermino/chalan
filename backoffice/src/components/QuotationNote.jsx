// La nota de una cotización como la escribió el transportista y, si el cliente
// la ve recortada (el API le quita las frases con montos o teléfonos:
// app/api/customer_note.py), qué le llega. Un "aparte" con precio que el
// cliente no ve es un cobro que no está en su total: hay que aclararlo.
export default function QuotationNote({ note, customerNote, className = 'text-sm text-gray-600' }) {
  if (!note) return null
  const trimmed = customerNote !== undefined && customerNote !== note
  return (
    <>
      <p className={`mt-1 whitespace-pre-line ${className}`}>“{note}”</p>
      {trimmed && (
        <p className="mt-1 max-w-xs whitespace-pre-line rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
          {customerNote
            ? <>El cliente ve: “{customerNote}”</>
            : 'El cliente no ve esta nota: trae montos o teléfonos.'}
        </p>
      )}
    </>
  )
}
