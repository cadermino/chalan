'use client'

import { useEffect, useRef } from 'react'
import { loadGooglePlaces } from '@/lib/googleMaps'

export type ApproxLocation = { latitude: number; longitude: number; radius_m: number }

// La zona de un pedido de servicio para quien va a cotizar: un círculo de 500 m
// cuyo centro está corrido del punto (lo calcula el API,
// address.approximate_location; el punto nunca llega aquí), como Airbnb. Se
// acerca y se mueve con dos dedos, con un tope de zoom para que el círculo siga
// siendo una zona. Mismo mapa que el link de las empresas en el backoffice
// (components/ApproxMap.jsx).
export function ApproxMap({ location }: { location: ApproxLocation | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const apiKey = process.env.NEXT_PUBLIC_PLACES_API_KEY
  const latitude = location?.latitude
  const longitude = location?.longitude
  const radius = location?.radius_m

  useEffect(() => {
    if (latitude == null || longitude == null || !apiKey) return
    let cancelled = false
    loadGooglePlaces(apiKey, () => {
      if (cancelled || !ref.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const google = (window as any).google
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
        strokeColor: '#4f46e5',
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: '#6366f1',
        fillOpacity: 0.2,
      })
    })
    return () => {
      cancelled = true
    }
  }, [latitude, longitude, radius, apiKey])

  if (latitude == null || longitude == null || !apiKey) return null
  return (
    <div
      ref={ref}
      role="img"
      aria-label="Zona aproximada del servicio"
      className="mt-4 h-60 w-full overflow-hidden rounded-2xl border border-gray-200"
    />
  )
}
