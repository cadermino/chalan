import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { instrumentSerif, interTight, jetbrainsMono } from '@/lib/fonts'
import { LandingNav } from '@/components/LandingNav'
import { LandingFooter } from '@/components/LandingFooter'
import '../landing.css'

// Precios "desde", de referencia y con la comisión de Chalán incluida. El precio
// final lo confirma el armador al cotizar, así que se ajustan a medida que
// lleguen cotizaciones reales. Se definieron mirando el tarifario de armado de
// las tiendas de mejoramiento del hogar (octubre de 2026); por decisión de
// negocio la página no nombra a ninguna.
const PRICES = [
  {
    id: '01',
    name: 'Sillas y futones',
    includes: 'Silla, sillón o futón de cualquier modelo',
    from: 29.9,
  },
  {
    id: '02',
    name: 'Básico',
    includes: 'Cabecera de cama, estante pequeño, escritorio, mesa de centro, mesa auxiliar, zapatera baja',
    from: 39.9,
  },
  {
    id: '03',
    name: 'Cocina',
    includes: 'Mueble bajo de cocina, verdulero, mueble de microondas',
    from: 54.9,
  },
  {
    id: '04',
    name: 'Intermedio',
    includes: 'Ropero de hasta 1.60 m, cómoda, velador, librero, juego de comedor, escritorio en L, zapatera alta',
    from: 59.9,
  },
  {
    id: '05',
    name: 'Avanzado',
    includes: 'Ropero de 1.61 m a 2.05 m, muebles de cocina altos y bajos grandes',
    from: 99.9,
  },
]

const soles = (n: number) => `S/ ${n.toFixed(2)}`
const lowestPrice = soles(Math.min(...PRICES.map((p) => p.from)))
const priceOf = (id: string) => soles(PRICES.find((p) => p.id === id)!.from)

export const metadata: Metadata = {
  title: 'Armado y desarmado de muebles a domicilio | Chalán',
  description:
    `Armamos y desarmamos muebles de melamina, roperos y cocinas de cualquier tienda. Lima, Callao y Huancayo, desde ${lowestPrice}. También para mudanzas.`,
  keywords:
    'armado de muebles a domicilio, armado de muebles de melamina, desarmado de muebles para mudanza, armado de muebles lima, armador de muebles, armado de roperos, armado de muebles huancayo',
  alternates: { canonical: '/armado-de-muebles' },
  openGraph: {
    title: 'Armado y desarmado de muebles a domicilio | Chalán',
    description:
      `Muebles de melamina, roperos, camas y cocinas de cualquier tienda. Lima, Callao y Huancayo. Desde ${lowestPrice}.`,
    url: 'https://chalan.pe/armado-de-muebles',
  },
}


// El formulario vive en otro contenedor (services-web): se enlaza con <a>, no con next/link.
const FORM_URL = '/armado/cotizar'

const WHATSAPP_URL =
  'https://wa.me/51972643007?text=Hola%2C%20quiero%20cotizar%20el%20armado%20o%20desarmado%20de%20muebles'

const MOVING_STEPS = [
  {
    n: '01',
    title: 'Desarmamos en tu casa actual',
    body: 'Roperos, camas, escritorios y cocinas, con cada pieza y tornillo identificado. Cuesta menos de la mitad del armado cuando son varios muebles.',
    icon: Wrench,
  },
  {
    n: '02',
    title: 'Trasladas tus muebles',
    body: 'Con el transporte que prefieras, o cotizando tu mudanza con Chalán en el mismo lugar.',
    icon: Truck,
  },
  {
    n: '03',
    title: 'Armamos en tu nuevo hogar',
    body: 'Se cotiza aparte, cuando los muebles ya estén en el nuevo departamento, y cuesta lo mismo que armar un mueble nuevo.',
    icon: Check,
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Cuéntanos qué muebles son',
    body: 'Lista qué hay que armar o desarmar, con la tienda o modelo si lo tienes, y súbele fotos o un video. Si prefieres, escríbenos por WhatsApp.',
    icon: Chat,
  },
  {
    n: '02',
    title: 'Te cotizamos y agendamos',
    body: 'Nuestro armador te confirma el precio final y coordinan el día y la hora.',
    icon: Cal,
  },
  {
    n: '03',
    title: 'Armamos y probamos',
    body: 'Dejamos el mueble armado, firme y funcionando: puertas, cajones y bisagras revisados.',
    icon: Check,
  },
]

// Una sola lista para la página y para el JSON-LD de FAQPage: `a` es el texto
// plano (lo que va al JSON-LD, que no puede llevar JSX) y `render`, cuando
// existe, es la versión con enlaces que se ve en la página.
const FAQ: { q: string; a: string; render?: ReactNode }[] = [
  {
    q: '¿Cuánto se cobra por armar un mueble de melamina?',
    a: `Depende del tamaño del mueble. Un escritorio, una cabecera o una mesa de centro desde ${priceOf('02')}; un ropero de hasta 1.60 m, una cómoda o un juego de comedor desde ${priceOf('04')}; un ropero de 1.61 a 2.05 m desde ${priceOf('05')}. Son precios de referencia: el precio final te lo confirma el armador al cotizar.`,
  },
  {
    q: '¿Arman muebles comprados en cualquier tienda?',
    a: 'Sí. Armamos muebles de cualquier tienda o marca, comprados en tienda física o por internet, y también muebles que ya tienes y quieres volver a armar.',
  },
  {
    q: '¿Cuánto cuesta desarmar un mueble?',
    a: 'El desarmado es más rápido que el armado: cuando son varios muebles cuesta menos de la mitad. Se cotiza según la cantidad y el tipo de muebles.',
  },
  {
    q: 'Me voy a mudar, ¿cómo funciona?',
    a: 'Desarmamos tus muebles en tu casa actual y, cuando ya estén en el nuevo departamento, los armamos ahí. En el formulario marca "Desarmar y armar" y pon las dos direcciones: el armador te cotiza el desarmado y el armado, que cuesta lo mismo que armar un mueble nuevo. Si quieres que también los embale, márcalo ahí mismo. El traslado lo puedes cotizar con Chalán.',
    render: (
      <>
        Desarmamos tus muebles en tu casa actual y, cuando ya estén en el nuevo departamento,
        los armamos ahí. En el formulario marca &ldquo;Desarmar y armar&rdquo; y pon las dos
        direcciones: el armador te cotiza el desarmado y el armado, que cuesta lo mismo que armar un
        mueble nuevo. Si quieres que también los embale, márcalo ahí mismo. El traslado lo puedes{' '}
        <Link href="/cotizar-mudanza">cotizar con Chalán</Link>, y para empacar toda la casa
        tenemos <Link href="/embalaje-profesional">embalaje a domicilio</Link>.
      </>
    ),
  },
  {
    q: '¿Qué no incluye el servicio?',
    a: 'No incluye adaptaciones, modificaciones ni cortes de piezas, ni el traslado del mueble ya armado a otro lugar.',
  },
  {
    q: '¿En qué zonas trabajan?',
    a: 'En todos los distritos de Lima Metropolitana y el Callao, y en Huancayo.',
    render: (
      <>
        En todos los distritos de Lima Metropolitana y el Callao, y en Huancayo, donde también
        hacemos <Link href="/mudanzas-huancayo">mudanzas</Link>.
      </>
    ),
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Armado y desarmado de muebles a domicilio',
  serviceType: 'Armado de muebles',
  provider: {
    '@type': 'LocalBusiness',
    name: 'Chalán',
    url: 'https://chalan.pe',
    telephone: '+51-972-643-007',
    address: { '@type': 'PostalAddress', addressLocality: 'Lima', addressCountry: 'PE' },
  },
  areaServed: [
    { '@type': 'City', name: 'Lima' },
    { '@type': 'City', name: 'Callao' },
    { '@type': 'City', name: 'Huancayo' },
  ],
  description:
    'Armado y desarmado de muebles a domicilio en Lima, Callao y Huancayo: melamina, roperos, camas, escritorios y cocinas de cualquier tienda.',
  url: 'https://chalan.pe/armado-de-muebles',
}

const jsonLdBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://chalan.pe' },
    { '@type': 'ListItem', position: 2, name: 'Armado de muebles', item: 'https://chalan.pe/armado-de-muebles' },
  ],
}

const jsonLdFaq = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

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

function Wrench() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />
    </svg>
  )
}

function Truck() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4h14v12H1z" /><path d="M15 9h4l3 3v4h-7z" /><circle cx="5.5" cy="18.5" r="2" /><circle cx="18.5" cy="18.5" r="2" />
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

export default function ArmadoDeMuebles() {
  const fontVars = [instrumentSerif.variable, interTight.variable, jetbrainsMono.variable].join(' ')

  return (
    <>
      <LandingNav
        links={[
          { label: 'Precios', href: '#precios' },
          { label: 'Mudanzas', href: '#mudanza' },
          { label: 'Cómo funciona', href: '#como' },
          { label: 'Preguntas', href: '#faq' },
          { label: 'Blog', href: '/blog' },
        ]}
        cta={{ label: 'Cotizar en 2 minutos', href: FORM_URL, plain: true }}
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
              Armado y desarmado · Lima, Callao y Huancayo
            </div>

            <div className="hero-grid">
              <h1 className="h-display">
                <span className="line">Armado y</span>
                <span className="line indent"><em>desarmado</em></span>
                <span className="line">de muebles.</span>
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
                  Melamina, roperos, camas, escritorios y cocinas, de cualquier tienda.
                  A domicilio, y también para tu mudanza.
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
                      Cuéntanos qué muebles hay que armar o desarmar, con fotos si las tienes, y
                      si también hay que embalarlos. Te confirmamos el precio por WhatsApp.
                    </p>
                  </div>
                  <a
                    href={FORM_URL}
                    className="btn btn-primary"
                    style={{ justifyContent: 'center', gap: 10, padding: '14px 20px', fontSize: 15 }}
                  >
                    Cotizar en 2 minutos
                    <Arrow className="arrow" />
                  </a>
                  <Link
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost"
                    style={{ justifyContent: 'center', gap: 10, padding: '12px 20px', fontSize: 14 }}
                  >
                    <WhatsAppIcon />
                    Prefiero escribir por WhatsApp
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
                    Desde {lowestPrice} · Cotización sin costo
                  </p>
                </div>
              </div>
            </div>

            <div className="hero-strip">
              <div className="kpi">
                <div className="num">{lowestPrice.replace('S/ ', '')}</div>
                <div className="label">Soles, precio desde</div>
              </div>
              <div className="kpi">
                <div className="num">Lima</div>
                <div className="label">También Callao y Huancayo</div>
              </div>
              <div className="kpi">
                <div className="num">2<span className="unit">×</span></div>
                <div className="label">Desarmado y armado en tu mudanza</div>
              </div>
              <div className="kpi">
                <div className="num">S/<span className="unit">0</span></div>
                <div className="label">Costo de cotización</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PRICES ── */}
        <section className="block" id="precios">
          <div className="wrap">
            <div className="section-head">
              <div className="num">01 / Precios</div>
              <h2 className="h-section">Precios de armado<br />según el mueble.</h2>
            </div>
            <div className="fleet">
              <div className="fleet-row head prices">
                <span />
                <span>Nivel y qué incluye</span>
                <span style={{ textAlign: 'right' }}>Precio</span>
              </div>
              {PRICES.map((p) => (
                <div className="fleet-row prices" key={p.id}>
                  <span className="idx">{p.id}</span>
                  <div>
                    <span className="name">{p.name}</span>
                    <span className="includes">{p.includes}</span>
                  </div>
                  <span className="price-from">
                    <span className="pre">desde</span>
                    {soles(p.from)}
                  </span>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 24, fontSize: 15, lineHeight: 1.6, color: 'var(--ink)', maxWidth: '70ch' }}>
              <strong>Desarmado:</strong> cuesta menos de la mitad del armado cuando son varios muebles.
              Se cotiza según la cantidad.
            </p>
            <p
              style={{
                marginTop: 12,
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--mute)',
                letterSpacing: '0.06em',
                lineHeight: 1.6,
              }}
            >
              * Precios de referencia. El precio final te lo confirma el armador al cotizar. No incluye
              adaptaciones, modificaciones ni cortes de piezas, ni el traslado del mueble ya armado.
            </p>
          </div>
        </section>

        {/* ── MOVING ── */}
        <section className="block" id="mudanza">
          <div className="wrap">
            <div className="section-head">
              <div className="num">02 / Mudanzas</div>
              <h2 className="h-section">¿Te mudas?<br />Desarmamos y<br />volvemos a armar.</h2>
            </div>
            <div className="steps">
              {MOVING_STEPS.map((s) => (
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
            <p style={{ marginTop: 28, fontSize: 15, lineHeight: 1.6, color: 'var(--ink-soft)', maxWidth: '70ch' }}>
              ¿Todavía no tienes transporte?{' '}
              <Link href="/cotizar-mudanza" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
                Cotiza tu mudanza con Chalán
              </Link>
              . Y si también necesitas empacar, mira nuestro{' '}
              <Link href="/embalaje-profesional" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
                embalaje a domicilio
              </Link>
              .
            </p>
          </div>
        </section>

        {/* ── NEW FURNITURE ── */}
        <section className="block" id="melamina">
          <div className="wrap">
            <div className="section-head">
              <div className="num">03 / Muebles nuevos</div>
              <h2 className="h-section">¿Compraste un mueble<br />de melamina?<br /><em>Lo armamos.</em></h2>
            </div>
            <p className="lede" style={{ maxWidth: '62ch' }}>
              Roperos, cómodas, escritorios, racks de TV, zapateras y muebles de cocina, de cualquier
              tienda o marca, comprados en tienda o por internet. Vamos a tu casa con las herramientas,
              lo armamos donde lo quieres y revisamos que puertas, cajones y bisagras funcionen.
            </p>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="block" id="como">
          <div className="wrap">
            <div className="section-head">
              <div className="num">04 / Proceso</div>
              <h2 className="h-section">Tres pasos.<br />Sin complicaciones.</h2>
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

        {/* ── FAQ ── */}
        <section className="block" id="faq">
          <div className="wrap">
            <div className="section-head">
              <div className="num">05 / Preguntas</div>
              <h2 className="h-section">Lo que suelen<br />preguntar primero.</h2>
            </div>
            <div>
              {FAQ.map((f, i) => (
                <details className="faq-item" key={f.q} open={i === 0}>
                  <summary>
                    <h3>{f.q}</h3>
                    <span className="plus">+</span>
                  </summary>
                  <p>{f.render ?? f.a}</p>
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
                  Agenda tu armado
                </div>
                <h2 className="h-section" style={{ maxWidth: '16ch' }}>
                  Tus muebles, firmes.<br />
                  <em>Cotiza en 2 minutos.</em>
                </h2>
                <p className="lede" style={{ marginTop: 24 }}>
                  Cuéntanos qué muebles son y dónde. Te confirmamos el precio y agendamos.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <a href={FORM_URL} className="btn btn-primary" style={{ gap: 10 }}>
                  Cotizar en 2 minutos
                  <Arrow className="arrow" />
                </a>
                <Link
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost"
                  style={{ gap: 10 }}
                >
                  <WhatsAppIcon />
                  Escribir por WhatsApp
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
