import AddressAutocomplete from './AddressAutocomplete'

// Dirección con sugerencias de Google más el dpto/referencia. La usan el paso de
// dirección y el destino del armado de muebles. El estado lo tiene el padre.
export default function AddressFields({ id, label, address, onChange, error, mapsError, onMapsError }) {
  const confirmed = Boolean(address.map_url)

  // Escribir descarta la sugerencia elegida: sin map_url la dirección no vale
  // (es la prueba de que salió de Google y no es texto libre).
  const handleText = (street) => onChange({
    ...address, street, map_url: '', neighborhood: '', city: '', state: '', country: '',
  })

  return (
    <>
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
            ✓ Dirección confirmada{address.neighborhood ? ` · ${address.neighborhood}` : ''}
          </p>
        )}
        {!confirmed && !error && !mapsError && (
          <p className="mt-1 text-xs text-mute">Escribe y elige la dirección de la lista.</p>
        )}
        {error && <p role="alert" className="mt-1 text-sm text-danger">{error}</p>}
      </div>

      <div>
        <label htmlFor={`${id}-interior`} className="mb-1 block text-sm font-semibold text-inkStrong">
          Dpto, interior o referencia <span className="font-normal text-mute">(opcional)</span>
        </label>
        <input
          id={`${id}-interior`}
          type="text"
          className="field"
          maxLength={100}
          placeholder="Ej. Dpto 402, torre B"
          data-clarity-mask="true"
          value={address.interior}
          onChange={(event) => onChange({ ...address, interior: event.target.value })}
        />
      </div>
    </>
  )
}
