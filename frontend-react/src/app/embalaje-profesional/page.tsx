import type { Metadata } from 'next'
import Link from 'next/link'
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from 'next/font/google'
import { LandingNav } from '@/components/LandingNav'
import { LandingFooter } from '@/components/LandingFooter'
import '../landing.css'

export const metadata: Metadata = {
  title: 'Servicio de embalaje profesional en Lima | Chalán',
  description:
    'Embalamos tus muebles, electrodomésticos y objetos frágiles con materiales profesionales. Servicio de embalaje a domicilio en Lima. Cotiza por WhatsApp.',
  keywords:
    'servicio de embalaje lima, embalaje de muebles, empacar muebles mudanza, embalaje profesional lima, embalaje a domicilio lima, empacar objetos frágiles',
  alternates: { canonical: '/embalaje-profesional' },
  openGraph: {
    title: 'Servicio de embalaje profesional en Lima | Chalán',
    description:
      'Embalamos tus muebles y objetos frágiles con materiales profesionales. Cotiza por WhatsApp.',
    url: 'https://chalan.pe/embalaje-profesional',
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

const WHATSAPP_URL =
  'https://wa.me/51972643007?text=Hola%2C%20quiero%20cotizar%20un%20servicio%20de%20embalaje%20profesional'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Servicio de embalaje profesional',
  provider: {
    '@type': 'LocalBusiness',
    name: 'Chalán',
    url: 'https://chalan.pe',
    telephone: '+51-972-643-007',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Lima',
      addressCountry: 'PE',
    },
  },
  areaServed: { '@type': 'City', name: 'Lima' },
  description:
    'Embalaje profesional a domicilio en Lima. Muebles, electrodomésticos y objetos frágiles con materiales de calidad.',
  url: 'https://chalan.pe/embalaje-profesional',
}

const jsonLdBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://chalan.pe' },
    { '@type': 'ListItem', position: 2, name: 'Embalaje profesional', item: 'https://chalan.pe/embalaje-profesional' },
  ],
}

const jsonLdFaq = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: '¿Qué incluye el servicio de embalaje?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Incluye mano de obra, materiales (cajas, plástico burbuja, film stretch, papel kraft y cinta), y el embalaje completo de tus pertenencias según el plan elegido.',
      },
    },
    {
      '@type': 'Question',
      name: '¿Hacen embalaje sin mudanza?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sí. El servicio de embalaje es completamente independiente. No necesitas contratar mudanza con nosotros para acceder a este servicio.',
      },
    },
    {
      '@type': 'Question',
      name: '¿Cuánto cuesta el embalaje de un departamento?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'El precio depende del tamaño del departamento y la cantidad de objetos frágiles. Escríbenos por WhatsApp y te damos un precio en minutos.',
      },
    },
    {
      '@type': 'Question',
      name: '¿Con cuánta anticipación debo agendar?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Recomendamos agendar con 24 a 48 horas de anticipación. Para servicios de embalaje completo de casa, con 2–3 días es ideal.',
      },
    },
    {
      '@type': 'Question',
      name: '¿Qué distritos cubren?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Cubrimos todos los distritos de Lima Metropolitana: Miraflores, San Isidro, Surco, La Molina, Barranco, Chorrillos, San Juan de Lurigancho, Los Olivos, Ate y más.',
      },
    },
  ],
}

const STEPS = [
  {
    n: '01',
    title: 'Cotiza por WhatsApp',
    body: 'Cuéntanos qué necesitas embalar — muebles, electrodomésticos, objetos frágiles — y te damos un precio en minutos.',
    icon: Chat,
  },
  {
    n: '02',
    title: 'Agendamos la fecha',
    body: 'Tú eliges el día y la hora. Llegamos puntuales con todo el material necesario.',
    icon: Cal,
  },
  {
    n: '03',
    title: 'Embalamos todo',
    body: 'Nuestro equipo embala cada pieza con cuidado: cajas, plástico burbuja, film stretch y etiquetado por ambiente.',
    icon: Box,
  },
  {
    n: '04',
    title: 'Listo para mover',
    body: 'Todo queda protegido y organizado. Puedes moverlo tú mismo o contratar el flete con Chalán.',
    icon: Check,
  },
]

const MATERIALS = [
  { name: 'Cajas de cartón', desc: 'Varios tamaños según el contenido' },
  { name: 'Plástico burbuja', desc: 'Para objetos frágiles y de vidrio' },
  { name: 'Film stretch', desc: 'Envuelve muebles y protege esquinas' },
  { name: 'Papel kraft', desc: 'Relleno y amortiguación interior' },
  { name: 'Cinta de embalaje', desc: 'Sellado profesional resistente' },
  { name: 'Etiquetado por ambiente', desc: 'Sala, cocina, dormitorio, etc.' },
]

const PACKAGES = [
  {
    id: '01',
    name: 'Solo habitación',
    desc: 'dormitorio o estudio',
    detail: 'Ideal si vas a mover un cuarto solo o tienes objetos sueltos que necesitan protección.',
    includes: ['Hasta 15 cajas', 'Objetos frágiles incluidos', 'Etiquetado básico'],
  },
  {
    id: '02',
    name: 'Departamento',
    desc: '1 a 3 ambientes',
    detail: 'Para apartments medianos. Cubre sala, comedor, cocina y dormitorios.',
    includes: ['Hasta 40 cajas', 'Muebles con film stretch', 'Electrodomésticos protegidos', 'Etiquetado por ambiente'],
  },
  {
    id: '03',
    name: 'Casa completa',
    desc: 'casa familiar',
    detail: 'Embalaje total de una casa. Ideal antes de una mudanza grande o almacenamiento prolongado.',
    includes: ['Cajas ilimitadas', 'Muebles y objetos de valor', 'Cuadros y espejos con protección especial', 'Inventario incluido'],
  },
]

const FAQ = [
  {
    q: '¿Qué incluye el servicio de embalaje?',
    a: 'Incluye mano de obra, materiales (cajas, plástico burbuja, film stretch, papel kraft y cinta) y el embalaje completo de tus pertenencias según el plan elegido.',
  },
  {
    q: '¿Hacen embalaje sin mudanza?',
    a: 'Sí. El servicio es completamente independiente. No necesitas contratar la mudanza con nosotros para acceder al embalaje.',
  },
  {
    q: '¿Cuánto cuesta el embalaje de un departamento?',
    a: 'El precio depende del tamaño y la cantidad de objetos frágiles. Escríbenos por WhatsApp y te cotizamos en minutos.',
  },
  {
    q: '¿Con cuánta anticipación debo agendar?',
    a: 'Con 24 a 48 horas es suficiente para habitaciones y departamentos. Para casas completas, 2–3 días es lo ideal.',
  },
  {
    q: '¿Qué distritos cubren?',
    a: 'Cubrimos todos los distritos de Lima Metropolitana: Miraflores, San Isidro, Surco, La Molina, Barranco, Chorrillos, San Juan de Lurigancho, Los Olivos, Ate y más.',
  },
]

// ─── Icons ───────────────────────────────────────────────────────────────────

function Arrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function Chat() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
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

function Box() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  )
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function EmbalajeProfesional() {
  const fontVars = [instrumentSerif.variable, interTight.variable, jetbrainsMono.variable].join(' ')

  return (
    <>
      <LandingNav
        links={[
          { label: 'Cómo funciona', href: '#como' },
          { label: 'Planes', href: '#planes' },
          { label: 'Materiales', href: '#materiales' },
          { label: 'Preguntas', href: '#faq' },
          { label: 'Blog', href: '/blog' },
        ]}
        cta={{
          label: 'Cotizar por WhatsApp',
          href: WHATSAPP_URL,
          external: true,
          icon: <WhatsAppIcon />,
        }}
      />
      <main id="main-content" className={`chalan-landing ${fontVars}`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

        {/* ── HERO ── */}
        <section className="hero">
          <div className="wrap">
            <div className="eyebrow" style={{ marginBottom: 36 }}>
              <span className="dot" />
              Servicio de embalaje · Lima, Perú
            </div>

            <div className="hero-grid">
              <h1 className="h-display">
                <span className="line">Embalaje</span>
                <span className="line indent"><em>profesional.</em></span>
                <span
                  className="line right"
                  style={{
                    fontFamily: 'var(--sans)',
                    fontSize: '0.32em',
                    fontWeight: 400,
                    letterSpacing: '-0.01em',
                    lineHeight: 1.2,
                    color: 'var(--ink-soft)',
                    marginTop: 18,
                    maxWidth: '22ch',
                    marginLeft: 'auto',
                  }}
                >
                  Empacamos tus muebles y objetos frágiles con materiales
                  profesionales. Sin mudanza obligatoria. A domicilio en Lima.
                </span>
              </h1>

              {/* CTA card */}
              <div>
                <div
                  style={{
                    background: 'var(--paper-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 14,
                    padding: 28,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 20,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 10,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: 'var(--mute)',
                        marginBottom: 8,
                      }}
                    >
                      Cotiza ahora
                    </div>
                    <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--ink)' }}>
                      Escríbenos por WhatsApp y te damos precio en minutos. Sin formularios.
                    </p>
                  </div>
                  <Link
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ justifyContent: 'center', gap: 10, padding: '14px 20px', fontSize: 15 }}
                  >
                    <WhatsAppIcon />
                    Cotizar por WhatsApp
                  </Link>
                  <p
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 10.5,
                      color: 'var(--mute)',
                      letterSpacing: '0.06em',
                      textAlign: 'center',
                    }}
                  >
                    Respuesta en menos de 15 minutos
                  </p>
                </div>
              </div>
            </div>

            <div className="hero-strip">
              <div className="kpi">
                <div className="num">24<span className="unit">h</span></div>
                <div className="label">Disponibilidad mínima</div>
              </div>
              <div className="kpi">
                <div className="num">100<span className="unit">%</span></div>
                <div className="label">Materiales incluidos</div>
              </div>
              <div className="kpi">
                <div className="num">Lima</div>
                <div className="label">Cobertura metropolitana</div>
              </div>
              <div className="kpi">
                <div className="num">S/<span className="unit">0</span></div>
                <div className="label">Costo de cotización</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="block" id="como">
          <div className="wrap">
            <div className="section-head">
              <div className="num">01 / Proceso</div>
              <h2 className="h-section">Cuatro pasos.<br />Todo queda listo.</h2>
            </div>
            <div className="steps">
              {STEPS.map((s) => (
                <div className="step" key={s.n}>
                  <div className="step-no">
                    <span className="acc">●</span>
                    {s.n}
                  </div>
                  <div className="step-icon">
                    <s.icon />
                  </div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PACKAGES ── */}
        <section className="block" id="planes">
          <div className="wrap">
            <div className="section-head">
              <div className="num">02 / Planes</div>
              <h2 className="h-section">Desde una<br />habitación hasta<br />una casa entera.</h2>
            </div>
            <div className="fleet">
              <div className="fleet-row head">
                <span />
                <span>Plan</span>
                <span className="col-hide">Ideal para</span>
                <span />
              </div>
              {PACKAGES.map((p) => (
                <div className="fleet-row" key={p.id} style={{ gridTemplateColumns: '60px 2fr 2fr 140px' }}>
                  <span className="idx">{p.id}</span>
                  <span className="name">
                    {p.name}
                    <span className="desc">— {p.desc}</span>
                  </span>
                  <span className="figure col-hide" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink-soft)' }}>
                    {p.detail}
                  </span>
                  <Link
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pick"
                  >
                    cotizar <Arrow />
                  </Link>
                </div>
              ))}
            </div>
            <p
              style={{
                marginTop: 24,
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--mute)',
                letterSpacing: '0.06em',
              }}
            >
              * Precio final según cantidad de objetos y materiales utilizados. Cotización sin compromiso.
            </p>
          </div>
        </section>

        {/* ── MATERIALS ── */}
        <section className="block" id="materiales">
          <div className="wrap">
            <div className="section-head">
              <div className="num">03 / Materiales</div>
              <h2 className="h-section">Todo incluido.<br />Nada extra.</h2>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 0,
                borderTop: '1px solid var(--line)',
                borderLeft: '1px solid var(--line)',
              }}
            >
              {MATERIALS.map((m) => (
                <div
                  key={m.name}
                  style={{
                    borderRight: '1px solid var(--line)',
                    borderBottom: '1px solid var(--line)',
                    padding: '28px 24px',
                    background: 'var(--paper)',
                    transition: 'background 0.18s',
                  }}
                  className="step"
                >
                  <h3 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 22, letterSpacing: '-0.01em', marginBottom: 8 }}>
                    {m.name}
                  </h3>
                  <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{m.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="block" id="faq">
          <div className="wrap">
            <div className="section-head">
              <div className="num">04 / Preguntas</div>
              <h2 className="h-section">Lo que suelen<br />preguntar primero.</h2>
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
                  Agenda tu embalaje
                </div>
                <h2 className="h-section" style={{ maxWidth: '16ch' }}>
                  Tus cosas, protegidas.<br />
                  <em>Cotiza en 2 minutos.</em>
                </h2>
                <p className="lede" style={{ marginTop: 24 }}>
                  Sin formularios, sin llamadas. Cuéntanos qué necesitas embalar y te damos precio por WhatsApp.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <Link
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ gap: 10 }}
                >
                  <WhatsAppIcon />
                  Escribir por WhatsApp
                  <Arrow className="arrow" />
                </Link>
                <Link href="/como-funciona" className="btn btn-ghost">
                  Cómo funciona
                </Link>
              </div>
            </div>
          </div>
        </section>

        <LandingFooter />
      </main>
    </>
  )
}
