'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'

// ─── Sizes ──────────────────────────────────────────────────────────────────

const SIZES = [
  { id: 'small',  label: 'Pequeño', hint: 'Habitación o paquetes',       Icon: BoxIcon,   base: 55,  perKm: 2.4 },
  { id: 'medium', label: 'Mediano', hint: 'Depto de 1–2 habitaciones',   Icon: SofaIcon,  base: 90,  perKm: 3.1 },
  { id: 'large',  label: 'Grande',  hint: 'Casa o depto familiar',        Icon: HouseIcon, base: 160, perKm: 4.6 },
]

// ─── Icons ───────────────────────────────────────────────────────────────────

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8H3M16 8V5a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" />
      <rect x="3" y="8" width="18" height="13" rx="1" />
      <path d="M10 12h4" />
    </svg>
  )
}
function SofaIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10V7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3" />
      <path d="M2 10a2 2 0 0 1 2-2h1v6H3a1 1 0 0 1-1-1v-3ZM22 10a2 2 0 0 0-2-2h-1v6h2a1 1 0 0 0 1-1v-3Z" />
      <path d="M5 14h14v2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-2Z" />
      <path d="M7 17v2M17 17v2" />
    </svg>
  )
}
function HouseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5 12 3l9 8.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1v-9" />
    </svg>
  )
}
const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10
}

type AddrComponents = { types: string[]; long_name: string }[]

function extractComponents(components: AddrComponents) {
  const map: Record<string, string> = {}
  components.forEach(c => { map[c.types[0]] = c.long_name })
  return map
}

type PlaceArg = {
  formatted_address?: string
  address_components?: AddrComponents
  url?: string
  lat?: number
  lng?: number
}

function saveOrigin(place: PlaceArg) {
  const c = extractComponents(place.address_components || [])
  localStorage.setItem('orderDetailsOrigin', JSON.stringify({
    from_street: place.formatted_address || null,
    from_interior_number: null,
    from_floor_number: null,
    from_zip_code: c.postal_code || null,
    from_country: c.country || null,
    from_map_url: place.url || null,
    from_approximate_distance_from_parking: null,
    from_has_elevator: null,
    from_lat: place.lat ?? null,
    from_lng: place.lng ?? null,
  }))
}

function saveDestination(place: PlaceArg) {
  const c = extractComponents(place.address_components || [])
  localStorage.setItem('orderDetailsDestination', JSON.stringify({
    to_street: place.formatted_address || null,
    to_interior_number: null,
    to_floor_number: null,
    to_zip_code: c.postal_code || null,
    to_country: c.country || null,
    to_map_url: place.url || null,
    to_approximate_distance_from_parking: null,
    to_has_elevator: null,
    to_lat: place.lat ?? null,
    to_lng: place.lng ?? null,
  }))
}

// ─── Widget ──────────────────────────────────────────────────────────────────

export function QuoteWidget() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sizeId, setSizeId] = useState('medium')
  const [km, setKm] = useState<number | null>(null)

  const fromRef = useRef<HTMLInputElement>(null)
  const toRef   = useRef<HTMLInputElement>(null)
  const fromLatLng = useRef<{ lat: number; lng: number } | null>(null)
  const toLatLng   = useRef<{ lat: number; lng: number } | null>(null)

  // Restaurar estado desde localStorage al volver a la landing
  useEffect(() => {
    try {
      const origin = JSON.parse(localStorage.getItem('orderDetailsOrigin') || 'null')
      const dest   = JSON.parse(localStorage.getItem('orderDetailsDestination') || 'null')
      if (origin?.from_street) setFrom(origin.from_street)
      if (dest?.to_street)     setTo(dest.to_street)
      if (origin?.from_lat && origin?.from_lng) fromLatLng.current = { lat: origin.from_lat, lng: origin.from_lng }
      if (dest?.to_lat && dest?.to_lng)         toLatLng.current   = { lat: dest.to_lat,     lng: dest.to_lng }
      if (fromLatLng.current && toLatLng.current) {
        setKm(haversineKm(fromLatLng.current.lat, fromLatLng.current.lng, toLatLng.current.lat, toLatLng.current.lng))
      }
      const savedSize = localStorage.getItem('quoteSize')
      if (savedSize && SIZES.find(s => s.id === savedSize)) setSizeId(savedSize)
    } catch { /* localStorage no disponible */ }
  }, [])

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_PLACES_API_KEY
    if (!apiKey || typeof window === 'undefined') return

    const init = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const google = (window as any).google
      if (!google?.maps?.places || !fromRef.current || !toRef.current) return

      const options = {
        componentRestrictions: { country: 'pe' },
        fields: ['formatted_address', 'address_components', 'geometry', 'url'],
      }

      const acFrom = new google.maps.places.Autocomplete(fromRef.current, options)
      acFrom.addListener('place_changed', () => {
        const place = acFrom.getPlace()
        if (!place.geometry?.location) return
        const lat: number = place.geometry.location.lat()
        const lng: number = place.geometry.location.lng()
        fromLatLng.current = { lat, lng }
        setFrom(place.formatted_address || '')
        saveOrigin({ ...place, lat, lng })
        if (toLatLng.current) setKm(haversineKm(lat, lng, toLatLng.current.lat, toLatLng.current.lng))
      })

      const acTo = new google.maps.places.Autocomplete(toRef.current, options)
      acTo.addListener('place_changed', () => {
        const place = acTo.getPlace()
        if (!place.geometry?.location) return
        const lat: number = place.geometry.location.lat()
        const lng: number = place.geometry.location.lng()
        toLatLng.current = { lat, lng }
        setTo(place.formatted_address || '')
        saveDestination({ ...place, lat, lng })
        if (fromLatLng.current) setKm(haversineKm(fromLatLng.current.lat, fromLatLng.current.lng, lat, lng))
      })

      // Si hay direcciones guardadas pero sin coordenadas, geocodificar para calcular km
      if (!fromLatLng.current || !toLatLng.current) {
        try {
          const origin = JSON.parse(localStorage.getItem('orderDetailsOrigin') || 'null')
          const dest   = JSON.parse(localStorage.getItem('orderDetailsDestination') || 'null')
          const fromStreet = origin?.from_street
          const toStreet   = dest?.to_street
          if (fromStreet && toStreet) {
            const geocoder = new google.maps.Geocoder()
            const geocode = (address: string, cb: (lat: number, lng: number) => void) => {
              geocoder.geocode({ address }, (results: any, status: any) => {
                if (status === 'OK' && results?.[0]?.geometry?.location) {
                  cb(results[0].geometry.location.lat(), results[0].geometry.location.lng())
                }
              })
            }
            geocode(fromStreet, (lat, lng) => {
              fromLatLng.current = { lat, lng }
              if (toLatLng.current) setKm(haversineKm(lat, lng, toLatLng.current.lat, toLatLng.current.lng))
            })
            geocode(toStreet, (lat, lng) => {
              toLatLng.current = { lat, lng }
              if (fromLatLng.current) setKm(haversineKm(fromLatLng.current.lat, fromLatLng.current.lng, lat, lng))
            })
          }
        } catch { /* sin acceso a localStorage */ }
      }
    }

    // Si Google ya está disponible, inicializar directamente
    if ((window as any).google?.maps?.places) {
      init()
      return
    }

    // Registrar callback antes de inyectar el script
    ;(window as any).__chalanPlacesReady = init

    if (!document.getElementById('gm-places-script')) {
      const script = document.createElement('script')
      script.id = 'gm-places-script'
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=__chalanPlacesReady`
      script.async = true
      document.head.appendChild(script)
    }
  }, [])

  const price = useMemo(() => {
    const s = SIZES.find(s => s.id === sizeId)
    if (!s || km === null) return null
    return Math.round(s.base + km * s.perKm)
  }, [sizeId, km])

  return (
    <div className="quote">
      <div className="quote-head">
        <span className="live">en vivo · cotización</span>
        {km !== null && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute)' }}>
            {km} km
          </span>
        )}
      </div>

      <div className="quote-row">
        <span className="pin" aria-hidden />
        <input
          ref={fromRef}
          className="quote-input"
          value={from}
          onChange={e => setFrom(e.target.value)}
          placeholder="¿Desde dónde?"
          autoComplete="off"
        />
      </div>
      <div className="quote-row" style={{ marginTop: -6, marginBottom: -6 }}>
        <span className="vline" aria-hidden />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--mute)', letterSpacing: '0.1em' }}>HACIA</span>
      </div>
      <div className="quote-row">
        <span className="pin b" aria-hidden />
        <input
          ref={toRef}
          className="quote-input"
          value={to}
          onChange={e => setTo(e.target.value)}
          placeholder="¿Hasta dónde?"
          autoComplete="off"
        />
      </div>

      <div className="quote-sizes">
        {SIZES.map(s => (
          <button
            key={s.id}
            className={'size-card' + (sizeId === s.id ? ' active' : '')}
            onClick={() => { setSizeId(s.id); localStorage.setItem('quoteSize', s.id) }}
            aria-pressed={sizeId === s.id}
            type="button"
          >
            <span className="size-icon"><s.Icon /></span>
            <span className="size-label">{s.label}</span>
            <span className="size-hint">{s.hint}</span>
          </button>
        ))}
      </div>

      {price !== null ? (
        <div className="quote-result">
          <span className="label">Total estimado</span>
          <span className="price">
            <span className="currency">S/</span>{price}
          </span>
        </div>
      ) : (
        <div className="quote-result quote-result--empty">
          <span className="label">Ingresa las direcciones para ver el precio</span>
        </div>
      )}

      <Link href="/order/step-one" className="quote-cta">
        Continuar con esta cotización
        <ArrowIcon />
      </Link>
    </div>
  )
}
