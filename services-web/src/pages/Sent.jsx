import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { track } from '../analytics'
import { COPY, PATHS, SERVICE, whatsappUrl } from '../config'

export default function Sent() {
  // Llega desde el último paso; al recargar se pierde y queda solo WhatsApp.
  const publicId = useLocation().state?.publicId

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
        Te avisamos por WhatsApp cuando llegue la primera cotización de {COPY.quotesFrom}. Las comparas y eliges en tu página de cotizaciones.
      </p>
      {publicId && (
        <Link className="btn-primary mt-8" to={`${PATHS.quotations}/${publicId}`}>
          Ver mis cotizaciones
        </Link>
      )}
      <p className="mt-4">
        <a
          className={publicId ? 'btn-secondary' : 'btn-primary mt-4'}
          href={whatsappUrl(COPY.whatsappSent)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Escríbenos por WhatsApp
        </a>
      </p>
      <p className="mt-6">
        <a href="https://chalan.pe" className="text-sm text-inkSoft underline">Volver a Chalán</a>
      </p>
    </div>
  )
}
