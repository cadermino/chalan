import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from 'next/font/google'
import { LandingNav } from '@/components/LandingNav'
import { LandingFooter } from '@/components/LandingFooter'
import { whatsappUrl } from '@/lib/homeServices'
import '@/app/landing.css'

// Landing de un servicio a domicilio que se cotiza por WhatsApp (pintura,
// microcemento, porcelanato, reparación de departamentos). Sin `prices` no hay
// tabla de precios: es el caso de un servicio que se cotiza con visita técnica. Mismo diseño que /armado-de-muebles; cada página
// trae solo su contenido. Cuando un servicio tenga formulario en services-web,
// el CTA principal pasa a ser el formulario, como en armado.

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

export const soles = (n: number) => `S/ ${n.toFixed(2)}`

export type ServicePrice = { id: string; name: string; includes: string; from: number }
export type ServiceStep = { n: string; title: string; body: string; icon: keyof typeof ICONS }
export type ServiceFaq = { q: string; a: string; render?: ReactNode }
export type ServiceSection = {
  id: string
  num: string
  title: ReactNode
  lede?: ReactNode
  steps?: ServiceStep[]
  after?: ReactNode
}

export type ServiceLandingProps = {
  path: string
  breadcrumbName: string
  eyebrow: string
  heroTitle: ReactNode
  heroSub: string
  ctaBody: string
  whatsappText: string
  // Textos del botón de WhatsApp y de su recuadro; por defecto, los de cotizar con precios.
  cta?: { eyebrow: string; label: string; note: string }
  // Ciudades de `areaServed`; por defecto Lima, Callao y Huancayo.
  areas?: string[]
  prices?: ServicePrice[]
  priceUnit?: string
  pricesTitle?: ReactNode
  pricesHeader?: string
  pricesNote?: ReactNode
  pricesFinePrint?: string
  kpis: { num: ReactNode; label: string }[]
  sections: ServiceSection[]
  steps: ServiceStep[]
  faq: ServiceFaq[]
  final: { eyebrow: string; title: ReactNode; lede: string }
  service: { name: string; serviceType: string; description: string }
  navLinks: { label: string; href: string }[]
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

const ICONS = {
  chat: () => <Svg><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Svg>,
  cal: () => <Svg><rect x="3" y="5" width="18" height="16" rx="1.5" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>,
  check: () => <Svg><polyline points="20 6 9 17 4 12" /></Svg>,
  brush: () => <Svg><path d="M3 3h14v6H3z" /><path d="M10 9v4" /><path d="M8 13h4v8H8z" /><path d="M17 6h4v5H10" /></Svg>,
  home: () => <Svg><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></Svg>,
  key: () => <Svg><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3M14 9l2 2" /></Svg>,
  layers: () => <Svg><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></Svg>,
  ruler: () => <Svg><path d="M3 17 17 3l4 4L7 21z" /><path d="m7 13 2 2M10 10l2 2M13 7l2 2" /></Svg>,
}

function Arrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
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

function Steps({ steps }: { steps: ServiceStep[] }) {
  return (
    <div className="steps">
      {steps.map((s) => {
        const Icon = ICONS[s.icon]
        return (
          <div className="step" key={s.n}>
            <div className="step-no">
              <span className="acc">●</span>
              {s.n}
            </div>
            <div className="step-icon">
              <Icon />
            </div>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function ServiceLanding(props: ServiceLandingProps) {
  const fontVars = [instrumentSerif.variable, interTight.variable, jetbrainsMono.variable].join(' ')
  const url = `https://chalan.pe${props.path}`
  const whatsapp = whatsappUrl(props.whatsappText)
  const prices = props.prices ?? []
  const lowest = prices.length ? soles(Math.min(...prices.map((p) => p.from))) : ''
  const cta = props.cta ?? {
    eyebrow: 'Cotiza ahora',
    label: 'Cotizar por WhatsApp',
    note: `Desde ${lowest} ${props.priceUnit ?? ''} · Cotización sin costo`,
  }
  // Con tabla de precios, las secciones siguientes empiezan en 02.
  const offset = prices.length ? 2 : 1

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: props.service.name,
    serviceType: props.service.serviceType,
    provider: {
      '@type': 'LocalBusiness',
      name: 'Chalán',
      url: 'https://chalan.pe',
      telephone: '+51-972-643-007',
      address: { '@type': 'PostalAddress', addressLocality: 'Lima', addressCountry: 'PE' },
    },
    areaServed: (props.areas ?? ['Lima', 'Callao', 'Huancayo']).map((name) => ({ '@type': 'City', name })),
    description: props.service.description,
    url,
  }
  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://chalan.pe' },
      { '@type': 'ListItem', position: 2, name: props.breadcrumbName, item: url },
    ],
  }
  const jsonLdFaq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: props.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  const whatsappButton = (label: string, style: CSSProperties) => (
    <Link href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={style}>
      <WhatsAppIcon />
      {label}
      <Arrow className="arrow" />
    </Link>
  )

  return (
    <>
      <LandingNav
        links={props.navLinks}
        cta={{ label: cta.label, href: whatsapp, plain: true, external: true }}
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
              {props.eyebrow}
            </div>

            <div className="hero-grid">
              <h1 className="h-display">
                {props.heroTitle}
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
                  {props.heroSub}
                </span>
              </h1>

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
                      {cta.eyebrow}
                    </div>
                    <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--ink)' }}>{props.ctaBody}</p>
                  </div>
                  {whatsappButton(cta.label, { justifyContent: 'center', gap: 10, padding: '14px 20px', fontSize: 15 })}
                  <p
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 10.5,
                      color: 'var(--mute)',
                      letterSpacing: '0.06em',
                      textAlign: 'center',
                    }}
                  >
                    {cta.note}
                  </p>
                </div>
              </div>
            </div>

            <div className="hero-strip">
              {props.kpis.map((k) => (
                <div className="kpi" key={k.label}>
                  <div className="num">{k.num}</div>
                  <div className="label">{k.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICES ── */}
        {prices.length > 0 && (
        <section className="block" id="precios">
          <div className="wrap">
            <div className="section-head">
              <div className="num">01 / Precios</div>
              <h2 className="h-section">{props.pricesTitle}</h2>
            </div>
            <div className="fleet">
              <div className="fleet-row head prices">
                <span />
                <span>{props.pricesHeader}</span>
                <span style={{ textAlign: 'right' }}>Precio</span>
              </div>
              {prices.map((p) => (
                <div className="fleet-row prices" key={p.id}>
                  <span className="idx">{p.id}</span>
                  <div>
                    <span className="name">{p.name}</span>
                    <span className="includes">{p.includes}</span>
                  </div>
                  <span className="price-from">
                    <span className="pre">desde</span>
                    {soles(p.from)}
                    <span className="pre" style={{ display: 'block' }}>{props.priceUnit}</span>
                  </span>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 24, fontSize: 15, lineHeight: 1.6, color: 'var(--ink)', maxWidth: '70ch' }}>
              {props.pricesNote}
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
              {props.pricesFinePrint}
            </p>
          </div>
        </section>
        )}

        {/* ── SECTIONS ── */}
        {props.sections.map((s) => (
          <section className="block" id={s.id} key={s.id}>
            <div className="wrap">
              <div className="section-head">
                <div className="num">{s.num}</div>
                <h2 className="h-section">{s.title}</h2>
              </div>
              {s.lede && <p className="lede" style={{ maxWidth: '62ch' }}>{s.lede}</p>}
              {s.steps && <Steps steps={s.steps} />}
              {s.after && (
                <p style={{ marginTop: 28, fontSize: 15, lineHeight: 1.6, color: 'var(--ink-soft)', maxWidth: '70ch' }}>
                  {s.after}
                </p>
              )}
            </div>
          </section>
        ))}

        {/* ── HOW IT WORKS ── */}
        <section className="block" id="como">
          <div className="wrap">
            <div className="section-head">
              <div className="num">{String(props.sections.length + offset).padStart(2, '0')} / Proceso</div>
              <h2 className="h-section">Tres pasos.<br />Sin complicaciones.</h2>
            </div>
            <Steps steps={props.steps} />
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="block" id="faq">
          <div className="wrap">
            <div className="section-head">
              <div className="num">{String(props.sections.length + offset + 1).padStart(2, '0')} / Preguntas</div>
              <h2 className="h-section">Lo que suelen<br />preguntar primero.</h2>
            </div>
            <div>
              {props.faq.map((f, i) => (
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
                  {props.final.eyebrow}
                </div>
                <h2 className="h-section" style={{ maxWidth: '16ch' }}>{props.final.title}</h2>
                <p className="lede" style={{ marginTop: 24 }}>{props.final.lede}</p>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {whatsappButton(cta.label, { gap: 10 })}
              </div>
            </div>
          </div>
        </section>

        <LandingFooter />
      </main>
    </>
  )
}
