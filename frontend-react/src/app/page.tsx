import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from 'next/font/google'
import { QuoteWidget } from '@/components/QuoteWidget'
import { LandingNav } from '@/components/LandingNav'
import { LandingFooter } from '@/components/LandingFooter'
import './landing.css'

export const metadata: Metadata = {
  title: 'Chalán — Mudanzas y fletes en Perú | Cotiza en minutos',
  description: 'Plataforma peruana de mudanzas y fletes. Compara precios, elige vehículo y agenda tu mudanza en minutos. Cobertura en Lima y 23 ciudades del Perú.',
  keywords: 'mudanzas perú, fletes lima, mudanza barata, cotizar mudanza, empresa de mudanzas, chalán, fletes interprovinciales, mudanzas lima',
  alternates: { canonical: 'https://chalan.pe' },
  openGraph: {
    title: 'Chalán — Mudanzas y fletes en Perú',
    description: 'Compara precios, elige vehículo y agenda tu mudanza en minutos. Lima y 23 ciudades del Perú.',
    url: 'https://chalan.pe',
    siteName: 'Chalán',
    type: 'website',
    locale: 'es_PE',
    images: [{ url: 'https://chalan-public.s3.amazonaws.com/home/truck-list-fb.png', width: 1519, height: 1506, alt: 'Chalán — Mudanzas y fletes en Perú' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chalán — Mudanzas y fletes en Perú',
    description: 'Compara precios, elige vehículo y agenda tu mudanza en minutos.',
    images: ['https://chalan-public.s3.amazonaws.com/home/truck-list-fb.png'],
  },
}

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
  display: 'swap',
})
const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter-tight',
  display: 'swap',
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

const jsonLdOrg = {
  '@context': 'https://schema.org',
  '@type': 'MovingCompany',
  '@id': 'https://chalan.pe/#organization',
  name: 'Chalán',
  url: 'https://chalan.pe',
  logo: 'https://chalan.pe/logo_chalan.png',
  description: 'Plataforma peruana de mudanzas y fletes. Cotiza, compara y agenda en minutos.',
  telephone: '+51-972-643-007',
  email: 'carlos.calderon@chalan.pe',
  foundingDate: '2014',
  address: { '@type': 'PostalAddress', addressLocality: 'Lima', addressRegion: 'Lima', addressCountry: 'PE' },
  geo: { '@type': 'GeoCoordinates', latitude: -12.046374, longitude: -77.042793 },
  areaServed: { '@type': 'Country', name: 'Perú' },
  serviceType: ['Mudanzas', 'Fletes', 'Transporte de carga', 'Mudanzas interprovinciales'],
  priceRange: '$$',
  aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.8', reviewCount: '14000', bestRating: '5' },
  sameAs: ['https://chalan.mx'],
}

const jsonLdWebSite = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://chalan.pe/#website',
  url: 'https://chalan.pe',
  name: 'Chalán',
  description: 'Plataforma peruana de mudanzas y fletes.',
  publisher: { '@id': 'https://chalan.pe/#organization' },
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: 'https://chalan.pe/order/step-one?q={search_term_string}' },
    'query-input': 'required name=search_term_string',
  },
}


const VEHICLES = [
  { id: 'moto',  name: 'Moto carga',     desc: 'para paquetes',    cap: '·  hasta 80 kg', dim: '0.4 m³', base: 28  },
  { id: 'carry', name: 'Carry',          desc: 'compactos',         cap: '·  500 kg',      dim: '2.0 m³', base: 55  },
  { id: 'h100',  name: 'H-100',          desc: 'depto chico',       cap: '·  1 t',         dim: '5.5 m³', base: 90  },
  { id: 'tres',  name: 'Camión 3 t',     desc: 'depto familiar',    cap: '·  3 t',         dim: '14 m³',  base: 160 },
  { id: 'cinco', name: 'Camión 5 t',     desc: 'casa completa',     cap: '·  5 t',         dim: '22 m³',  base: 230 },
  { id: 'furg',  name: 'Furgón cerrado', desc: 'carga delicada',    cap: '·  7 t',         dim: '30 m³',  base: 320 },
]

const STEPS = [
  { n: '01', title: 'Indícanos las direcciones', body: 'De punto A a punto B. Calculamos ruta y distancia automáticamente.', icon: Pin },
  { n: '02', title: 'Fecha y hora',              body: 'Tú eliges cuándo. Disponibilidad en tiempo real, mismo día incluido.', icon: Cal },
  { n: '03', title: 'Escoge la movilidad',       body: 'Lista comparada de vehículos según tamaño, precio y reputación del chalán.', icon: Truck },
  { n: '04', title: 'Pagas como prefieras',      body: 'Yape, Plin, transferencia, tarjeta o efectivo al final del servicio.', icon: Card },
]

const ROUTES = [
  ['Lima', 'Arequipa', 580], ['Lima', 'Trujillo', 420], ['Lima', 'Huancayo', 340],
  ['Lima', 'Ica', 210], ['Lima', 'Chiclayo', 490], ['Lima', 'Piura', 680],
  ['Arequipa', 'Cusco', 360], ['Lima', 'Cajamarca', 620],
] as const

const FAQ = [
  { q: '¿Cómo se calcula el precio?', a: 'Tarifa base por tipo de vehículo + distancia recorrida + tiempo de servicio. No hay cargos sorpresa: el monto que ves al cotizar es el monto final.' },
  { q: '¿Qué pasa si necesito ayuda con la carga?', a: 'Puedes agregar uno o dos estibadores al momento de cotizar. Tarifa fija por hora, transparente desde el inicio.' },
  { q: '¿Operan fuera de Lima?', a: 'Sí. Atendemos las principales rutas interprovinciales del Perú y mudanzas dentro de Arequipa, Trujillo, Huancayo, Piura, Chiclayo, Ica y Cusco.' },
  { q: '¿Qué pasa si algo se daña en el viaje?', a: 'Todos nuestros chalanes están verificados y cuentan con seguro de mercadería. Reportas el incidente desde la app y tomamos cargo.' },
  { q: '¿Puedo agendar para el mismo día?', a: 'En Lima Metropolitana hay disponibilidad casi inmediata. Para servicios interprovinciales recomendamos agendar con 24 h de anticipación.' },
]

const TICKER_ITEMS = [
  'Lima → Arequipa', 'Lima → Trujillo', 'San Isidro → Surco', 'Miraflores → La Molina',
  'Callao → Lima', 'Lima → Huancayo', 'Barranco → Magdalena', 'Lima → Ica',
]

// ─── Icons ──────────────────────────────────────────────────────────────────

function Arrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}
function Star() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}
function Pin() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12Z" /><circle cx="12" cy="9" r="2.4" />
    </svg>
  )
}
function Cal() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="1.5" /><path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  )
}
function Truck() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 7h11v9H2zM13 10h5l3 3v3h-8" /><circle cx="6" cy="18" r="2" /><circle cx="17" cy="18" r="2" />
    </svg>
  )
}
function Card() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="13" rx="1.5" /><path d="M2 11h20M6 16h4" />
    </svg>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function Home() {
  const fontVars = [instrumentSerif.variable, interTight.variable, jetbrainsMono.variable].join(' ')
  const year = new Date().getFullYear()

  const jsonLdFaq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  return (
    <>
      <LandingNav />
      <main id="main-content" className={`chalan-landing ${fontVars}`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrg) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebSite) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />

      {/* ── HERO ── */}
      <section className="hero">
        <div className="wrap">
          <div className="eyebrow" style={{ marginBottom: 36 }}>
            <span className="dot" />
            Mudanzas y fletes — Perú · 2014→{year}
          </div>

          <div className="hero-grid">
            <h1 className="h-display">
              <span className="line">Múdate</span>
              <span className="line indent"><em>fácil.</em></span>
              <span className="line right" style={{ fontFamily: 'var(--sans)', fontSize: '0.32em', fontWeight: 400, letterSpacing: '-0.01em', lineHeight: 1.2, color: 'var(--ink-soft)', marginTop: 18, maxWidth: '22ch', marginLeft: 'auto' }}>
                Una sola plataforma para encontrar el vehículo, el chofer y el precio justos —
                en Lima y en cualquier ciudad del Perú.
              </span>
            </h1>
            <div className="hero-meta">
              <QuoteWidget />
            </div>
          </div>

          <div className="hero-strip">
            <div className="kpi"><div className="num">14<span className="unit">k+</span></div><div className="label">Mudanzas completadas</div></div>
            <div className="kpi"><div className="num">4.8<span className="unit">/5</span></div><div className="label">Calificación promedio</div></div>
            <div className="kpi"><div className="num">23<span className="unit">ciudades</span></div><div className="label">Cobertura nacional</div></div>
            <div className="kpi"><div className="num">11<span className="unit">min</span></div><div className="label">Tiempo medio de cotización</div></div>
          </div>
        </div>
      </section>

      {/* ── TICKER ── */}
      <div className="ticker" aria-hidden>
        <div className="ticker-track">
          {[0, 1, 2].map(rep => (
            <span key={rep}>
              {TICKER_ITEMS.map((t, i) => (
                <span key={i}><b>{t}</b><span className="ac">★</span></span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section className="block" id="como">
        <div className="wrap">
          <div className="section-head">
            <div className="num">01 / Proceso</div>
            <h2 className="h-section">Cuatro pasos.<br />Cero llamadas, cero regateo.</h2>
          </div>
          <div className="steps">
            {STEPS.map(s => (
              <div className="step" key={s.n}>
                <div className="step-no"><span className="acc">●</span>{s.n}</div>
                <div className="step-icon"><s.icon /></div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FLEET ── */}
      <section className="block" id="flota">
        <div className="wrap">
          <div className="section-head">
            <div className="num">02 / Flota</div>
            <h2 className="h-section">Desde una caja<br />hasta una casa entera.</h2>
          </div>
          <div className="fleet">
            <div className="fleet-row head">
              <span />
              <span>Vehículo</span>
              <span className="col-hide">Capacidad</span>
              <span className="col-hide">Volumen</span>
              <span>Desde</span>
              <span />
            </div>
            {VEHICLES.map((v, i) => (
              <div className="fleet-row" key={v.id}>
                <span className="idx">0{i + 1}</span>
                <span className="name">{v.name}<span className="desc">— {v.desc}</span></span>
                <span className="figure col-hide">{v.cap}</span>
                <span className="figure col-hide">{v.dim}</span>
                <span className="price-from"><span className="pre">S/</span>{v.base}</span>
                <Link href="/order/step-one" className="pick">cotizar <Arrow /></Link>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 24, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute)', letterSpacing: '0.06em' }}>
            * Tarifas base. Precio final depende de distancia, fecha y servicios adicionales.
          </p>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="block">
        <div className="wrap">
          <div className="section-head">
            <div className="num">03 / Reseñas</div>
            <h2 className="h-section">Verificadas,<br />no inventadas.</h2>
          </div>
          <div className="testimonials">
            <div className="t-card span-5">
              <div className="t-stars">{[0,1,2,3,4].map(i => <Star key={i} />)}</div>
              <p className="t-quote">&ldquo;Pude elegir entre varias opciones y precios. Los chicos llegaron a la hora y el cobro fue exactamente el que cotizamos.&rdquo;</p>
              <div className="t-meta">
                <span className="who">Demian M.</span>
                <span className="where">SAN BORJA → SURCO · CARRY</span>
              </div>
            </div>
            <div className="t-card span-4">
              <div className="t-stars">{[0,1,2,3,4].map(i => <Star key={i} />)}</div>
              <p className="t-quote">&ldquo;Súper recomendable. Coticé a las 9, a las 11 ya tenía el camión en la puerta.&rdquo;</p>
              <div className="t-meta">
                <span className="who">Sofía P.</span>
                <span className="where">MIRAFLORES → BARRANCO · H-100</span>
              </div>
            </div>
            <div className="t-card span-3">
              <div className="t-stars">{[0,1,2,3,4].map(i => <Star key={i} />)}</div>
              <p className="t-quote">&ldquo;La plataforma cotiza y agenda en menos de cinco minutos.&rdquo;</p>
              <div className="t-meta">
                <span className="who">Daniel N.</span>
                <span className="where">LIMA → ICA · 3 t</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ROUTES ── */}
      <section className="block" id="rutas">
        <div className="wrap">
          <div className="section-head">
            <div className="num">04 / Rutas</div>
            <h2 className="h-section">Fletes interprovinciales<br />a precio fijo.</h2>
          </div>
          <div className="routes">
            {ROUTES.map(([a, b, p], i) => (
              <Link className="route" key={i} href="/order/step-one">
                <div className="from-to">
                  <span>{a}</span>
                  <span className="dash" aria-hidden />
                  <span>{b}</span>
                </div>
                <div className="r-price">
                  desde
                  <b>S/ {p}</b>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="block" id="faq">
        <div className="wrap">
          <div className="section-head">
            <div className="num">05 / Preguntas</div>
            <h2 className="h-section">Lo que normalmente preguntan antes de mudarse.</h2>
          </div>
          <div>
            {FAQ.map((f, i) => (
              <details className="faq-item" key={i} open={i === 0}>
                <summary>
                  <h3>{f.q}</h3>
                  <span className="plus">+</span>
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="block final" id="cotizar">
        <div className="wrap">
          <div className="final-inner">
            <div>
              <div className="eyebrow" style={{ color: 'rgba(243,237,226,0.55)', marginBottom: 24 }}>
                <span className="dot" />
                Empieza ahora
              </div>
              <h2 className="h-section" style={{ maxWidth: '16ch' }}>
                Tu próxima mudanza,<br /><em>cotizada en 2 minutos.</em>
              </h2>
              <p className="lede" style={{ marginTop: 24 }}>
                Sin formularios largos, sin llamadas. Pones origen, destino y fecha — y comparas precios reales al instante.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <Link href="/order/step-one" className="btn btn-primary">Ver precios <Arrow className="arrow" /></Link>
              <Link href="/contacto" className="btn btn-ghost">Hablar con soporte</Link>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </main>
    </>
  )
}
