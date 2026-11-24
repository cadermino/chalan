import AddressAutocomplete from './AddressAutocomplete'
import PinMap from './PinMap'
import { track } from '../analytics'
import { SERVICE } from '../config'
import { isPinned } from '../maps'

// Dirección con sugerencias de Google y, debajo, el mapa. La usan el paso de
// dirección y el destino del armado de muebles. El estado lo tiene el padre.
//
// Igual que el paso 1 de mudanzas: si Google no sugiere la dirección, el
// cliente busca la calle o un lugar cercano y toca el mapa donde es (PinMap).
// Antes quedaba trabado en "Elige tu dirección de la lista".
export default function AddressFields({ id, label, address, onChange, error, mapsError, onMapsError }) {
  const pinned = isPinned(address)
  const confirmed = Boolean(address.map_url)

  // Escribir descarta la sugerencia elegida: sin map_url la dirección no vale
  // (es la prueba de que es un punto del mapa y no texto libre). Un punto
  // marcado en el mapa se queda: ahí el texto es la dirección como la escribe
  // el cliente.
  const handleText = (street) => onChange(pinned
    ? { ...address, street }
    : {
      ...address, street, map_url: '', neighborhood: '', city: '', state: '', country: '',
      latitude: null, longitude: null,
    })

  const handlePin = (next) => {
    onChange({ ...next, interior: address.interior })
    track('address_pin_set', { service: SERVICE, placement: id })
  }

  return (
    <div>
      <label htmlFor={`${id}-street`} className="mb-1 block text-sm font-semibold text-inkStrong">
        {label} <span className="text-danger">*</span>
      </label>
      <AddressAutocomplete
        id={`${id}-street`}
        value={address.street}
        invalid={Boolean(error)}
        disabled={mapsError}
        onTextChange={handleText}
        onPlaceSelected={(place) => onChange({ ...address, ...place })}
        onMapsError={onMapsError}
      />
      {confirmed && (
        <p className="mt-1 text-sm text-accent">
          ✓ {pinned ? 'Marcada en el mapa' : 'Dirección confirmada'}{address.neighborhood ? ` · ${address.neighborhood}` : ''}
        </p>
      )}
      {!confirmed && !error && !mapsError && (
        <p className="mt-1 text-xs text-mute">
          Escribe y elige una de las sugerencias. ¿No aparece tu dirección? Busca la calle o un lugar cercano y
          toca el mapa en el lugar exacto.
        </p>
      )}
      {error && <p role="alert" className="mt-1 text-sm text-danger">{error}</p>}
      {!mapsError && (
        <PinMap id={`${id}-map`} address={address} onPin={handlePin} onMapsError={onMapsError} />
      )}
    </div>
  )
}
