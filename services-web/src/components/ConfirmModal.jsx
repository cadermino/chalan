import { useEffect, useRef, useState } from 'react'
import { COPY } from '../config'

const asset = (name) => `${import.meta.env.BASE_URL}${name}`

export const money = (value) =>
  `S/ ${Number(value).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// El mismo rango que acepta el API (operation_numbers.py): sirve para
// descartar vacíos y basura, no para validar contra Yape.
const cleanNumber = (raw) => raw.replace(/\D/g, '')
const validNumber = (number) => number.length >= 4 && number.length <= 20

// Mismo flujo que PaymentConfirmationModal.vue de las mudanzas: confirmar la
// cotización y, si el servidor lo pide, yapear la reserva e informar el número
// de operación. `correcting` es para la reserva ya informada que sigue por
// verificar: solo se cambia el número.
export default function ConfirmModal({ quotation, summary, reservationRequired, correcting, onConfirm, onClose }) {
  const [number, setNumber] = useState('')
  const [error, setError] = useState('')
  const [numberError, setNumberError] = useState(false)
  const [busy, setBusy] = useState(false)
  const panelRef = useRef(null)
  const withReservation = reservationRequired && quotation.reservation_amount > 0

  // El listener se crea una vez; busy y onClose cambian en cada render.
  const latest = useRef({})
  latest.current = { busy, onClose }

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !latest.current.busy) latest.current.onClose()
    }
    document.addEventListener('keydown', onKey)
    // Sin esto la página de atrás sigue scrolleando en el celular.
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [])

  const submit = async () => {
    setError('')
    setNumberError(false)
    const cleaned = cleanNumber(number)
    if (withReservation && !validNumber(cleaned)) {
      setError('Ingresa el número de operación de tu yapeo.')
      setNumberError(true)
      return
    }
    setBusy(true)
    try {
      await onConfirm(withReservation ? cleaned : null)
    } catch (err) {
      const reason = err?.response?.data?.message
      if (reason === 'invalid_operation_number') {
        setError('Revisa el número de operación.')
        setNumberError(true)
      } else if (reason === 'operation_number_already_used') {
        setError('Ese número de operación ya se usó en otra reserva.')
        setNumberError(true)
      } else {
        setError(err?.response ? 'Hubo un error, inténtalo de nuevo.' : 'No hay conexión. Revisa tu internet e inténtalo de nuevo.')
      }
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-paper p-5 outline-none sm:mx-4 sm:rounded-2xl"
      >
        <button
          type="button"
          aria-label="Cerrar"
          disabled={busy}
          onClick={onClose}
          className="absolute right-3 top-3 h-9 w-9 rounded-full text-xl text-mute hover:text-inkStrong"
        >
          ×
        </button>
        <h2 id="confirm-title" className="pr-8 text-lg font-semibold text-inkStrong">
          {correcting ? 'Corrige tu número de operación' : 'Confirma tu servicio'}
        </h2>

        {!correcting && (
          <div className="mt-3">
            <p className="text-2xl font-semibold text-inkStrong">{money(quotation.total_amount)}</p>
            <p className="mt-1 text-sm text-inkSoft">{quotation.carrier_name}</p>
            {summary && <p className="text-sm text-inkSoft">{summary}</p>}
          </div>
        )}

        {!withReservation && (
          <p className="mt-4 text-sm text-inkSoft">
            El pago es en efectivo, directo a {quotation.carrier_name}, {COPY.payDay}.
          </p>
        )}

        {withReservation && (
          <div className="mt-4 rounded-xl border border-line p-4">
            {!correcting && (
              <>
                <p className="text-sm font-semibold text-inkStrong">Yapea tu reserva para agendar</p>
                <p className="mt-1 text-sm text-inkSoft">
                  Yapea <span className="font-semibold text-inkStrong">{money(quotation.reservation_amount)}</span> para
                  agendar. El resto ({money(quotation.on_site_amount)}) se lo pagas a {quotation.carrier_name}{' '}
                  {COPY.payDay}.
                </p>
                {/* width/height son los píxeles del archivo: reservan la caja antes de que baje y el modal no salta. */}
                <img
                  src={asset('yape-qr.jpg')}
                  alt="Código QR de Yape para reservar tu servicio"
                  width="460"
                  height="700"
                  className="mx-auto mt-3 w-40 rounded"
                />
                <p className="mt-2 hidden text-center text-xs text-mute sm:block">Escanéalo desde la app de Yape.</p>
                {/* Desde el celular no se puede escanear la propia pantalla: Yape deja subir la imagen. */}
                <div className="mt-2 text-center sm:hidden">
                  <a href={asset('yape-qr.jpg')} download="yape-chalan.jpg" className="text-sm text-accent underline">
                    Descargar el QR
                  </a>
                  <p className="mt-1 text-xs text-mute">Luego en Yape: Escanear QR → subir imagen.</p>
                </div>
              </>
            )}

            <label htmlFor="operation-number" className="mb-1 mt-4 block text-sm font-semibold text-inkStrong">
              Número de operación <span className="text-danger">*</span>
            </label>
            <input
              id="operation-number"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className={`field ${numberError ? 'border-danger' : ''}`}
              placeholder="Ej. 12345678"
              maxLength={30}
              value={number}
              onChange={(event) => { setNumber(event.target.value); setNumberError(false) }}
            />
            <p className="mt-1 text-xs text-mute">Lo ves en el comprobante de Yape después de yapear.</p>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-accent underline">¿Dónde está el número de operación?</summary>
              <img
                src={asset('yape-operation-number.jpg')}
                alt="Comprobante de Yape con el número de operación resaltado"
                width="640"
                height="612"
                className="mx-auto mt-2 w-full max-w-xs rounded"
              />
            </details>
          </div>
        )}

        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}

        <button type="button" className="btn-primary mt-5 w-full" disabled={busy} onClick={submit}>
          {busy ? 'Enviando…' : correcting ? 'Guardar número' : 'Agendar'}
        </button>
      </div>
    </div>
  )
}
