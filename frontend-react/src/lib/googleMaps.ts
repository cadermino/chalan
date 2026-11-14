// Carga el script de Google Maps (con Places) una sola vez aunque haya varios
// componentes que lo usan en la misma página (el cotizador, el mapa aproximado
// de /v/<token>), encolando el init de cada uno.
export function loadGooglePlaces(apiKey: string, onReady: () => void) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any

  if (w.google?.maps?.places) {
    onReady()
    return
  }

  if (!w.__chalanPlacesCallbacks) w.__chalanPlacesCallbacks = []
  w.__chalanPlacesCallbacks.push(onReady)

  if (w.__chalanPlacesLoading) return
  w.__chalanPlacesLoading = true

  w.__chalanPlacesReady = () => {
    w.__chalanPlacesCallbacks.forEach((cb: () => void) => cb())
    w.__chalanPlacesCallbacks = []
  }

  if (!document.getElementById('gm-places-script')) {
    const script = document.createElement('script')
    script.id = 'gm-places-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=__chalanPlacesReady`
    script.async = true
    document.head.appendChild(script)
  }
}
