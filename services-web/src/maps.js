import { PLACES_API_KEY } from './config'

let loading = null
let authFailed = false
const authFailureListeners = new Set()

// Google rechaza la key recién cuando se usa (al escribir en el campo), mucho
// después de que el script cargó y la promesa se resolvió. Sin este aviso el
// campo queda deshabilitado por Google y la pantalla no ofrece WhatsApp.
export function onMapsAuthFailure(callback) {
  if (authFailed) {
    callback()
    return () => {}
  }
  authFailureListeners.add(callback)
  return () => authFailureListeners.delete(callback)
}

// Carga el script de Google Maps una sola vez (mismo patrón que
// frontend/src/components/SearchBoxPlacesApiGoogle.vue). La promesa se rechaza si
// el script no baja o si Google rechaza la key (gm_authFailure), para que la
// pantalla ofrezca WhatsApp en vez de dejar al cliente frente a un campo muerto.
export function loadGoogleMaps() {
  if (authFailed) return Promise.reject(new Error('Google rechazó la API key'))
  if (window.google?.maps?.places) return Promise.resolve(window.google)
  if (loading) return loading

  loading = new Promise((resolve, reject) => {
    if (!PLACES_API_KEY) {
      reject(new Error('VITE_PLACES_API_KEY no está configurada'))
      return
    }
    window.gm_authFailure = () => {
      authFailed = true
      reject(new Error('Google rechazó la API key'))
      authFailureListeners.forEach((callback) => callback())
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${PLACES_API_KEY}&libraries=places&language=es&region=PE`
    script.async = true
    script.onload = () => {
      if (window.google?.maps?.places) resolve(window.google)
      else reject(new Error('Google Places no cargó'))
    }
    script.onerror = () => reject(new Error('No se pudo cargar Google Maps'))
    document.head.appendChild(script)
  }).catch((err) => {
    loading = null
    throw err
  })
  return loading
}

function component(place, type, useShortName = false) {
  const found = (place.address_components || []).find((c) => c.types.includes(type))
  if (!found) return ''
  return useShortName ? found.short_name : found.long_name
}

// Mapea un lugar de Places a los campos que guarda la solicitud (límites de
// largo = columnas de service_requests).
export function addressFromPlace(place) {
  return {
    street: (place.formatted_address || '').slice(0, 200),
    // En Lima `locality` es el distrito (Jesús María) y `sublocality_level_1`
    // la urbanización (Fundo Oyague), que no les dice nada a las empresas.
    neighborhood: (component(place, 'locality') || component(place, 'sublocality_level_1')).slice(0, 100),
    city: (component(place, 'administrative_area_level_2') || component(place, 'locality')).slice(0, 100),
    state: component(place, 'administrative_area_level_1').slice(0, 100),
    country: component(place, 'country', true).slice(0, 20),
    map_url: (place.url || '').slice(0, 400),
    // El punto, para el mapa aproximado que ven las empresas (un círculo
    // corrido, nunca este punto).
    latitude: place.geometry?.location?.lat() ?? null,
    longitude: place.geometry?.location?.lng() ?? null,
  }
}

// Para la casa que Google no sugiere: el cliente toca el mapa donde es (mismo
// comportamiento que el paso 1 de mudanzas, frontend/src/components/
// SearchBoxPlacesApiGoogle.vue). El punto se guarda como un link de
// coordenadas, que es también como se reconoce después que vino de un pin.
const PIN_URL = 'https://www.google.com/maps/search/?api=1&query='

export const pinUrl = (lat, lng) => `${PIN_URL}${lat.toFixed(6)},${lng.toFixed(6)}`

export const isPinned = (address) => Boolean(address?.map_url?.startsWith(PIN_URL))

// La dirección de un punto, o null. El geocoder es lo exacto, pero la key
// necesita la Geocoding API habilitada (la de local no la tiene). Si no
// responde, sale de Places el lugar de Google más cercano: su calle y número
// pueden no ser los de la casa (el aviso del mapa pide corregirlos).
export function describePoint(google, map, location) {
  const { places } = google.maps
  const service = new places.PlacesService(map)
  const details = (placeId) => new Promise((resolve) => {
    service.getDetails({ placeId, fields: ['address_components', 'formatted_address'] }, (place, status) => {
      resolve(status === places.PlacesServiceStatus.OK && place ? place : null)
    })
  })
  const nearest = () => new Promise((resolve) => {
    service.nearbySearch({ location, radius: 300 }, (results, status) => {
      if (status !== places.PlacesServiceStatus.OK || !results?.length) {
        resolve(null)
        return
      }
      const distance = (place) => (place.geometry?.location
        ? (place.geometry.location.lat() - location.lat()) ** 2 + (place.geometry.location.lng() - location.lng()) ** 2
        : Infinity)
      // Un distrito o la ciudad también son "lugares", pero sin calle.
      const spots = results.filter((place) => !(place.types || []).includes('political'))
      const [closest] = (spots.length ? spots : results).sort((a, b) => distance(a) - distance(b))
      resolve(details(closest.place_id))
    })
  })
  return new Promise((resolve) => {
    new google.maps.Geocoder().geocode({ location }, (results, status) => {
      if (status === 'OK' && results?.[0]) resolve(results[0])
      else resolve(nearest())
    })
  })
}

// La dirección que se guarda para un pin. Como en mudanzas, el pin escribe en
// el campo la dirección de Google para ese punto y el cliente corrige ahí el
// número (o Mz. y Lt.); lo que había escrito queda solo si Google no da nada.
export function addressFromPin(found, location, typed) {
  const fromGoogle = found ? addressFromPlace({ ...found, url: '', geometry: { location } }) : {}
  const street = fromGoogle.street || (typed || '').trim()
    || `Punto en el mapa (${location.lat().toFixed(5)}, ${location.lng().toFixed(5)})`
  return {
    ...fromGoogle,
    street: street.slice(0, 200),
    country: fromGoogle.country || 'PE',
    map_url: pinUrl(location.lat(), location.lng()),
    latitude: location.lat(),
    longitude: location.lng(),
  }
}
