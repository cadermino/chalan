import { PLACES_API_KEY } from './config'

let loading = null

// Carga el script de Google Maps una sola vez (mismo patrón que
// frontend/src/components/SearchBoxPlacesApiGoogle.vue). La promesa se rechaza si
// el script no baja o si Google rechaza la key (gm_authFailure), para que la
// pantalla ofrezca WhatsApp en vez de dejar al cliente frente a un campo muerto.
export function loadGoogleMaps() {
  if (window.google?.maps?.places) return Promise.resolve(window.google)
  if (loading) return loading

  loading = new Promise((resolve, reject) => {
    if (!PLACES_API_KEY) {
      reject(new Error('VITE_PLACES_API_KEY no está configurada'))
      return
    }
    window.gm_authFailure = () => reject(new Error('Google rechazó la API key'))
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
    neighborhood: (component(place, 'sublocality_level_1') || component(place, 'locality')).slice(0, 100),
    city: (component(place, 'administrative_area_level_2') || component(place, 'locality')).slice(0, 100),
    state: component(place, 'administrative_area_level_1').slice(0, 100),
    country: component(place, 'country', true).slice(0, 20),
    map_url: (place.url || '').slice(0, 400),
  }
}
