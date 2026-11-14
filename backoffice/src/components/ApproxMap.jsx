import { useEffect, useRef, useState } from 'react'

// La zona de un pedido de servicio para una empresa que todavía no fue
// elegida: un círculo de 500 m cuyo centro está corrido del punto (lo calcula
// el API, address.approximate_location; el punto nunca llega aquí), como
// Airbnb. Se acerca y se mueve con dos dedos, con un tope de zoom para que el
// círculo siga siendo una zona y no una cuadra.
const KEY = import.meta.env.VITE_PLACES_API_KEY

let loading = null

function loadMaps() {
  if (window.google?.maps?.Map) return Promise.resolve(window.google)
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    window.__chalanApproxMapReady = () => resolve(window.google)
    const script = document.createElement('script')
    script.async = true
    script.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&language=es&region=PE&callback=__chalanApproxMapReady`
    script.onerror = () => {
      loading = null
      reject(new Error('No cargó Google Maps'))
    }
    document.head.appendChild(script)
  })
  return loading
}

export default function ApproxMap({ location }) {
  const ref = useRef(null)
  const [failed, setFailed] = useState(false)
  const { latitude, longitude, radius_m: radius } = location || {}

  useEffect(() => {
    if (latitude == null || longitude == null || !KEY) return undefined
    let cancelled = false
    loadMaps()
      .then((google) => {
        if (cancelled || !ref.current) return
        const center = { lat: latitude, lng: longitude }
        const map = new google.maps.Map(ref.current, {
          center,
          zoom: 15,
          minZoom: 10,
          maxZoom: 16,
          // Con un dedo se sigue bajando por la página; con dos se mueve el mapa.
          gestureHandling: 'cooperative',
          clickableIcons: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        })
        new google.maps.Circle({
          map,
          center,
          radius,
          clickable: false,
          strokeColor: '#0d9488',
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: '#14b8a6',
          fillOpacity: 0.2,
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [latitude, longitude, radius])

  if (latitude == null || longitude == null || !KEY || failed) return null
  return (
    <div
      ref={ref}
      role="img"
      aria-label="Zona aproximada del servicio"
      className="mt-3 h-56 w-full overflow-hidden rounded-lg border border-gray-200"
    />
  )
}
