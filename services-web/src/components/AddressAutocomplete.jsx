import { useEffect, useRef } from 'react'
import { addressFromPlace, loadGoogleMaps } from '../maps'

// Input con sugerencias de Google Places. El valor lo controla el padre; cuando
// el usuario elige una sugerencia se avisa con los campos ya mapeados, y cuando
// escribe se avisa el texto (el padre descarta la selección anterior).
export default function AddressAutocomplete({ id, value, disabled, invalid, onTextChange, onPlaceSelected, onMapsError }) {
  const inputRef = useRef(null)
  // Los handlers cambian en cada render; el listener de Google se crea una sola vez.
  const handlers = useRef({})
  handlers.current = { onPlaceSelected, onMapsError }

  useEffect(() => {
    let cancelled = false
    let listener = null
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !inputRef.current) return
        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'pe' },
          fields: ['address_components', 'formatted_address', 'url'],
        })
        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          // Sin formatted_address el usuario apretó Enter sin elegir nada.
          if (!place || !place.formatted_address) return
          handlers.current.onPlaceSelected(addressFromPlace(place))
        })
      })
      .catch((err) => {
        if (!cancelled) handlers.current.onMapsError(err)
      })
    return () => {
      cancelled = true
      if (listener) listener.remove()
      // El desplegable de Google cuelga de <body>; sin esto quedaría uno por cada montaje.
      document.querySelectorAll('.pac-container').forEach((node) => node.remove())
    }
  }, [])

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      className={`field ${invalid ? 'border-danger' : ''}`}
      placeholder="Calle, número y distrito"
      autoComplete="off"
      maxLength={200}
      disabled={disabled}
      value={value}
      onChange={(event) => onTextChange(event.target.value)}
      // Enter dentro de las sugerencias no debe enviar el formulario.
      onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }}
    />
  )
}
