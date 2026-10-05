import { useEffect } from 'react'
import { track } from '../../analytics'
import { SERVICE, whatsappUrl } from '../../config'

export default function Sent() {
  useEffect(() => {
    track('service_request_step_view', { service: SERVICE, step: 'sent' })
  }, [])

  return (
    <div className="py-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accentSoft text-accent">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h1 className="mt-5 text-2xl font-semibold text-inkStrong">¡Recibimos tu solicitud!</h1>
      <p className="mx-auto mt-2 max-w-sm text-inkSoft">
        Te escribiremos por WhatsApp con las cotizaciones de los transportistas.
      </p>
      <a
        className="btn-primary mt-8"
        href={whatsappUrl('Hola, acabo de enviar una solicitud de embalaje')}
        target="_blank"
        rel="noopener noreferrer"
      >
        Escríbenos por WhatsApp
      </a>
      <p className="mt-6">
        <a href="https://chalan.pe" className="text-sm text-inkSoft underline">Volver a Chalán</a>
      </p>
    </div>
  )
}
