import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AddressFields from '../components/AddressFields'
import StepNav from '../components/StepNav'
import StepTracker from '../components/StepTracker'
import { friendlyError } from '../api'
import { saveFailure, track, trackBlocked } from '../analytics'
import { COPY, PATHS, SERVICE, whatsappUrl } from '../config'
import { useRequest } from '../context/RequestContext'

function AddressForm() {
  const { draft, saveAddress } = useRequest()
  const navigate = useNavigate()
  const [address, setAddress] = useState(draft.address)
  const [website, setWebsite] = useState('') // honeypot: un humano nunca lo ve
  const [error, setError] = useState('')
  const [mapsError, setMapsError] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    track('service_request_step_view', { service: SERVICE, step: 'address' })
  }, [])

  const handleNext = async () => {
    if (!address.map_url) {
      trackBlocked(SERVICE, 'address', 'map_url')
      setError('Elige tu dirección de la lista de sugerencias.')
      return
    }
    setSaving(true)
    try {
      await saveAddress(address, website)
      navigate(PATHS.items)
    } catch (err) {
      trackBlocked(SERVICE, 'address', saveFailure(err))
      setError(friendlyError(err, 'No pudimos guardar la dirección. Inténtalo de nuevo.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <StepTracker current={1} />
      <h1 className="text-2xl font-semibold text-inkStrong">{COPY.addressTitle}</h1>
      <p className="mt-1 text-inkSoft">{COPY.addressLead}</p>

      <div className="mt-6 space-y-5">
        <AddressFields
          id="address"
          label="Dirección"
          address={address}
          onChange={(next) => { setError(''); setAddress(next) }}
          error={error}
          mapsError={mapsError}
          onMapsError={() => setMapsError(true)}
        />

        {mapsError && (
          <div role="alert" className="rounded-lg border border-line bg-paper2 p-4 text-sm">
            <p className="text-inkStrong">No pudimos cargar el buscador de direcciones.</p>
            <p className="mt-1 text-inkSoft">Recarga la página o cuéntanos qué necesitas por WhatsApp.</p>
            <a
              className="btn-primary mt-3"
              href={whatsappUrl(COPY.whatsappAsk)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Escribir por WhatsApp
            </a>
          </div>
        )}

        {/* Honeypot: fuera de pantalla y de la tabulación. Los bots llenan todos los campos. */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px' }}>
          <label>
            Sitio web
            <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>
      </div>

      <StepNav onNext={handleNext} loading={saving} disabled={mapsError} />
    </>
  )
}

export default function AddressStep() {
  const { ready } = useRequest()
  // El formulario toma su estado inicial del borrador, que se retoma de forma
  // asíncrona: se monta recién cuando ya se sabe si había uno.
  if (!ready) return <p className="py-16 text-center text-inkSoft">Cargando…</p>
  return <AddressForm />
}
