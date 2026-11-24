import { useEffect, useRef, useState } from 'react'
import { addressFromPin, describePoint, isPinned, loadGoogleMaps } from '../maps'

// Más lejos que esto un toque cae a cuadras de la casa: el toque acerca el mapa
// ahí y el pin se pone cuando ya se ven las calles (como en mudanzas,
// frontend/src/components/SearchBoxPlacesApiGoogle.vue).
const PIN_ZOOM = 16
const ZOOM_STEP = 4
const ZOOM_TO_PIN = 18
const LIMA = { lat: -12.06, lng: -77.04 }

const pointOf = (address) => (address.latitude != null && address.longitude != null
  ? { lat: address.latitude, lng: address.longitude }
  : null)

// El mapa bajo el campo de dirección: muestra la sugerencia elegida y, para la
// casa que Google no sugiere, deja tocar donde es. onPin recibe la dirección
// ya armada, con la de Google para ese punto como calle.
export default function PinMap({ id, address, onPin, onMapsError }) {
  const element = useRef(null)
  const state = useRef({})
  // Con un pin ya puesto (recargó, o volvió desde otro paso) el aviso sigue ahí.
  const [pinnedHere, setPinnedHere] = useState(() => isPinned(address))
  // Un pin tocado que Google todavía está ubicando.
  const pending = useRef(false)
  // Los handlers y la dirección cambian en cada render; los listeners de Google
  // se crean una sola vez.
  const latest = useRef({})
  latest.current = { onPin, onMapsError, street: address.street }

  const point = pointOf(address)
  const lat = point?.lat
  const lng = point?.lng

  useEffect(() => {
    let cancelled = false
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !element.current) return
        const map = new google.maps.Map(element.current, {
          center: LIMA,
          zoom: 11,
          mapTypeId: 'roadmap',
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        })
        // Sin pisar state.current: ahí está `follow`, que pone el marcador de
        // una dirección ya guardada en cuanto el mapa existe.
        Object.assign(state.current, { google, map, marker: null })

        map.addListener('click', (event) => {
          if (!event.latLng) return
          if (map.getZoom() < PIN_ZOOM) {
            map.setCenter(event.latLng)
            map.setZoom(Math.min(map.getZoom() + ZOOM_STEP, ZOOM_TO_PIN))
            return
          }
          const location = event.latLng
          // El aviso sale al tocar y se queda: si se escondía mientras Google
          // ubicaba el punto, parpadeaba con cada pin.
          setPinnedHere(true)
          pending.current = true
          describePoint(google, map, location).then((found) => {
            if (cancelled) return
            pending.current = false
            latest.current.onPin(addressFromPin(found, location, latest.current.street))
          })
        })
        state.current.follow?.()
      })
      .catch((err) => {
        if (!cancelled) latest.current.onMapsError(err)
      })
    return () => {
      cancelled = true
      if (state.current.marker) state.current.marker.setMap(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Si después elige una sugerencia, el aviso del pin ya no corresponde. Solo
  // cambia cuando cambia el punto, no mientras se ubica un pin: así no parpadea.
  const pinned = isPinned(address)
  useEffect(() => {
    if (!pinned && !pending.current) setPinnedHere(false)
  }, [pinned, address.map_url])

  // El marcador sigue al punto de la dirección: el de la sugerencia elegida, el
  // del toque o el que ya estaba guardado.
  useEffect(() => {
    const follow = () => {
      const { google, map } = state.current
      if (!map) return
      if (state.current.marker) state.current.marker.setMap(null)
      state.current.marker = null
      if (lat == null || lng == null) return
      // No clickable: el puntero de los marcadores revienta en marker.js
      // (Sentry, en mudanzas). Se escucha el mapa.
      state.current.marker = new google.maps.Marker({ map, position: { lat, lng }, clickable: false })
      // Un toque ya está a la vista: recentrar haría saltar el mapa bajo el dedo.
      if (!map.getBounds()?.contains({ lat, lng }) || map.getZoom() < PIN_ZOOM) {
        map.setCenter({ lat, lng })
        if (map.getZoom() < ZOOM_TO_PIN - 1) map.setZoom(ZOOM_TO_PIN - 1)
      }
    }
    state.current.follow = follow
    follow()
  }, [lat, lng])

  return (
    <div className="mt-3">
      <div
        id={id}
        ref={element}
        className="h-64 w-full overflow-hidden rounded-lg border border-line bg-paper2"
        aria-label="Mapa de tu dirección"
      />
      {pinnedHere && (
        <p className="mt-2 text-sm text-inkSoft">
          Pusimos la dirección del pin en el campo de la dirección. Si el número no es exacto, corrígelo ahí
          (también Mz. y Lt.).
        </p>
      )}
    </div>
  )
}
