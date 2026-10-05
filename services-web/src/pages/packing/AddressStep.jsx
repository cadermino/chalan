import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AddressAutocomplete from '../../components/AddressAutocomplete'
import StepNav from '../../components/StepNav'
import StepTracker from '../../components/StepTracker'
import { friendlyError } from '../../api'
import { track } from '../../analytics'
import { PATHS, SERVICE, whatsappUrl } from '../../config'
import { useRequest } from '../../context/RequestContext'

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

  const confirmed = Boolean(address.map_url)

  // Escribir descarta la sugerencia elegida: sin map_url la dirección no vale
  // (es la prueba de que salió de Google y no es texto libre).
  const handleText = (street) => {
    setError('')
    setAddress((current) => ({
      ...current, street, map_url: '', neighborhood: '', city: '', state: '', country: '',
    }))
  }

  const handlePlace = (place) => {
    setError('')
    setAddress((current) => ({ ...current, ...place }))
  }

  const handleNext = async () => {
    if (!confirmed) {
      setError('Elige tu dirección de la lista de sugerencias.')
      return
    }
    setSaving(true)
    try {
      await saveAddress(address, website)
      navigate(PATHS.items)
    } catch (err) {
      setError(friendlyError(err, 'No pudimos guardar la dirección. Inténtalo de nuevo.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <StepTracker current={1} />
      <h1 className="text-2xl font-semibold text-inkStrong">¿Dónde hay que embalar?</h1>
      <p className="mt-1 text-inkSoft">Vamos a tu domicilio con todo el material.</p>

      <div className="mt-6 space-y-5">
        <div>
          <label htmlFor="address-street" className="mb-1 block text-sm font-semibold text-inkStrong">
            Dirección <span className="text-danger">*</span>
          </label>
          <AddressAutocomplete
            id="address-street"
            value={address.street}
            invalid={Boolean(error)}
            disabled={mapsError}
            onTextChange={handleText}
            onPlaceSelected={handlePlace}
            onMapsError={() => setMapsError(true)}
          />
          {confirmed && (
            <p className="mt-1 text-sm text-accent">
              ✓ Dirección confirmada{address.neighborhood ? ` · ${address.neighborhood}` : ''}
            </p>
          )}
          {!confirmed && !error && !mapsError && (
            <p className="mt-1 text-xs text-mute">Escribe y elige tu dirección de la lista.</p>
          )}
          {error && <p role="alert" className="mt-1 text-sm text-danger">{error}</p>}
        </div>

        {mapsError && (
          <div role="alert" className="rounded-lg border border-line bg-paper2 p-4 text-sm">
            <p className="text-inkStrong">No pudimos cargar el buscador de direcciones.</p>
            <p className="mt-1 text-inkSoft">Recarga la página o cuéntanos qué necesitas por WhatsApp.</p>
            <a
              className="btn-primary mt-3"
              href={whatsappUrl('Hola, quiero cotizar un servicio de embalaje')}
              target="_blank"
              rel="noopener noreferrer"
            >
              Escribir por WhatsApp
            </a>
          </div>
        )}

        <div>
          <label htmlFor="address-interior" className="mb-1 block text-sm font-semibold text-inkStrong">
            Dpto, interior o referencia <span className="font-normal text-mute">(opcional)</span>
          </label>
          <input
            id="address-interior"
            type="text"
            className="field"
            maxLength={100}
            placeholder="Ej. Dpto 402, torre B"
            value={address.interior}
            onChange={(event) => setAddress((current) => ({ ...current, interior: event.target.value }))}
          />
        </div>

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
