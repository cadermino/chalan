import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from 'next/font/google'
import { QuoteWidget } from '@/components/QuoteWidget'
import { LandingNav } from '@/components/LandingNav'
import { LandingFooter } from '@/components/LandingFooter'
import { Testimonials } from '@/components/Testimonials'
import './landing.css'

export const metadata: Metadata = {
  title: 'Mudanzas y Fletes en Perú | Cotiza en Minutos - Chalán',
  description: 'Cotiza tu mudanza o flete en minutos. Compara precios y vehículos de transportistas verificados. Cobertura en Lima y 23 ciudades del Perú.',
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
  image: 'https://chalan-public.s3.amazonaws.com/home/truck-list-fb.png',
  description: 'Plataforma peruana de mudanzas y fletes. Cotiza, compara y agenda en minutos.',
  telephone: '+51-972-643-007',
  email: 'carlos.calderon@chalan.pe',
  foundingDate: '2014',
  address: { '@type': 'PostalAddress', addressLocality: 'Lima', addressRegion: 'Lima', addressCountry: 'PE' },
  geo: { '@type': 'GeoCoordinates', latitude: -12.046374, longitude: -77.042793 },
  areaServed: { '@type': 'Country', name: 'Perú' },
  serviceType: ['Mudanzas', 'Fletes', 'Transporte de carga', 'Mudanzas interprovinciales'],
  priceRange: '$$',
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
  { n: '03', title: 'Escoge y confirma',         body: 'Compara vehículos por tamaño, precio y reputación del chalán. Eliges, confirmas y pagas en efectivo al finalizar.', icon: Truck },
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

      <Testimonials sectionNumber="01" />

      {/* ── HOW IT WORKS ── */}
      <section className="block" id="como">
        <div className="wrap">
          <div className="section-head">
            <div className="num">02 / Proceso</div>
            <h2 className="h-section">Tres pasos.<br />Cero llamadas, cero regateo.</h2>
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
            <div className="num">03 / Flota</div>
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

      {/* ── SERVICES ── */}
      <section className="block">
        <div className="wrap">
          <div className="section-head">
            <div className="num">03b / Servicios</div>
            <h2 className="h-section">¿Solo necesitas<br />embalar?</h2>
          </div>
          <div className="fleet">
            <div className="fleet-row head">
              <span />
              <span>Servicio</span>
              <span className="col-hide">Descripción</span>
              <span />
            </div>
            <div className="fleet-row" style={{ gridTemplateColumns: '60px 2fr 3fr 140px' }}>
              <span className="idx">01</span>
              <span className="name">Embalaje profesional<span className="desc">— a domicilio en Lima</span></span>
              <span className="figure col-hide" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                Materiales incluidos. Sin mudanza obligatoria.
              </span>
              <Link href="/embalaje-profesional" className="pick">ver servicio <Arrow /></Link>
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
