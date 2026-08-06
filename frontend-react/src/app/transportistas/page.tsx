import type { Metadata } from 'next'
import Link from 'next/link'
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from 'next/font/google'
import { LandingNav } from '@/components/LandingNav'
import { LandingFooter } from '@/components/LandingFooter'
import { CarrierSignupForm } from '@/components/CarrierSignupForm'
import '../landing.css'

export const metadata: Metadata = {
  title: 'Trabaja con Chalán - Registra tu empresa de mudanzas | Chalán',
  description:
    'Únete a la red de transportistas de Chalán en Perú. Recibe pedidos de mudanza sin gastar en marketing, elige qué mudanzas tomar y gestiona todo desde tu panel. Registro gratis.',
  keywords:
    'trabajar como transportista chalan, empresa de mudanzas afiliarse, transportistas peru, chalanes chalan, unirse chalan mudanzas',
  alternates: { canonical: '/transportistas' },
  openGraph: {
    title: 'Trabaja con Chalán - Registra tu empresa de mudanzas',
    description: 'Recibe pedidos de mudanza sin gastar en marketing. Regístrate gratis y empieza a cotizar.',
    url: 'https://chalan.pe/transportistas',
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
  '@type': 'Organization',
  name: 'Chalán',
  url: 'https://chalan.pe',
  logo: 'https://chalan.pe/logo_chalan.png',
  sameAs: ['https://wa.me/51972643007'],
}

const BENEFITS = [
  { n: '01', title: 'Más pedidos, sin gastar en marketing', body: 'Recibes solicitudes de clientes que ya están buscando mudanza en Chalán. Tú no pagas por publicidad propia.', icon: Inbox },
  { n: '02', title: 'Tú decides qué mudanzas tomar', body: 'Cotizas solo los pedidos que te convienen — no hay obligación de aceptar todo lo que llega.', icon: Check },
  { n: '03', title: 'Sin costo de entrada', body: 'Registrarte y crear el perfil de tu empresa es gratis. No hay cuota de afiliación.', icon: Gift },
  { n: '04', title: 'Panel propio para gestionar todo', body: 'Administra vehículos, cotizaciones y pedidos desde un solo lugar, sin planillas ni WhatsApp perdido.', icon: Grid },
]

const STEPS = [
  { n: '01', title: 'Regístrate', body: 'Completa el formulario con tus datos. Toma menos de dos minutos.' },
  { n: '02', title: 'Completa tu perfil', body: 'Una vez aprobada tu cuenta, agrega los datos de tu empresa y tus vehículos.' },
  { n: '03', title: 'Cotiza pedidos', body: 'Verás las mudanzas disponibles y podrás cotizar las que te convengan.' },
  { n: '04', title: 'Cobra por tu trabajo', body: 'Realizas la mudanza y recibes el pago del pedido cotizado.' },
]

const FAQ = [
  { q: '¿Cuánto cuesta registrarse?', a: 'Nada. Crear tu cuenta y el perfil de tu empresa es gratis, sin cuota de afiliación.' },
  { q: '¿Estoy obligado a aceptar todas las mudanzas?', a: 'No. Tú decides a qué pedidos cotizar según la ruta, el tamaño y la fecha que te convengan.' },
  { q: '¿Cuánto tiempo tarda la aprobación de mi cuenta?', a: 'Un administrador revisa y activa las cuentas nuevas normalmente en poco tiempo. Te avisaremos cuando puedas empezar a cotizar.' },
  { q: '¿Qué necesito para completar mi perfil?', a: 'Después de la aprobación, completas desde tu panel los datos de tu empresa y de tus vehículos (marca, capacidad, tarifas).' },
]

const jsonLdFaq = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function Arrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}
function Inbox() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h5l2 3h4l2-3h5" /><path d="M5 5h14l2 7v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7l2-7Z" />
    </svg>
  )
}
function Check() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.2 2.2 4.8-5" />
    </svg>
  )
}
function Gift() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="13" rx="1" /><path d="M3 12h18M12 8v13" />
      <path d="M12 8c-2 0-3.5-1.5-3.5-3S9.5 2 11 2s1 3 1 6ZM12 8c2 0 3.5-1.5 3.5-3S13.5 2 12 2s-1 3-1 6Z" />
    </svg>
  )
}
function Grid() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" />
    </svg>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function Transportistas() {
  const fontVars = [instrumentSerif.variable, interTight.variable, jetbrainsMono.variable].join(' ')

  return (
    <>
      <LandingNav />
      <main id="main-content" className={`chalan-landing ${fontVars}`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrg) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />

        {/* ── HERO ── */}
        <section className="hero">
          <div className="wrap">
            <div className="eyebrow" style={{ marginBottom: 36 }}>
              <span className="dot" />
              Transportistas — únete a la red Chalán
            </div>

            <div className="hero-grid">
              <h1 className="h-display">
                <span className="line">Más pedidos.</span>
                <span className="line indent"><em>Cero anuncios.</em></span>
                <span className="line right" style={{ fontFamily: 'var(--sans)', fontSize: '0.32em', fontWeight: 400, letterSpacing: '-0.01em', lineHeight: 1.2, color: 'var(--ink-soft)', marginTop: 18, maxWidth: '22ch', marginLeft: 'auto' }}>
                  Recibe solicitudes de mudanza de clientes reales que ya están
                  buscando en Chalán — tú eliges cuáles cotizar.
                </span>
              </h1>
              <div className="hero-meta" id="registro">
                <CarrierSignupForm />
              </div>
            </div>
          </div>
        </section>

        {/* ── BENEFICIOS ── */}
        <section className="block" id="beneficios">
          <div className="wrap">
            <div className="section-head">
              <div className="num">01 / Beneficios</div>
              <h2 className="h-section">Por qué trabajar<br />con Chalán.</h2>
            </div>
            <div className="steps">
              {BENEFITS.map((b) => (
                <div className="step" key={b.n}>
                  <div className="step-no"><span className="acc">●</span>{b.n}</div>
                  <div className="step-icon"><b.icon /></div>
                  <h3>{b.title}</h3>
                  <p>{b.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CÓMO FUNCIONA ── */}
        <section className="block" id="como">
          <div className="wrap">
            <div className="section-head">
              <div className="num">02 / Proceso</div>
              <h2 className="h-section">De registrarte<br />a cobrar tu primer pedido.</h2>
            </div>
            <div className="steps">
              {STEPS.map((s) => (
                <div className="step" key={s.n}>
                  <div className="step-no"><span className="acc">●</span>{s.n}</div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 24, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute)', letterSpacing: '0.06em' }}>
              * Tip: los transportistas que cotizan en menos de 5 minutos después de recibir un pedido
              tienen más chances de ganarlo — los clientes suelen elegir entre las primeras respuestas.
            </p>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="block" id="faq">
          <div className="wrap">
            <div className="section-head">
              <div className="num">03 / Preguntas</div>
              <h2 className="h-section">Lo que normalmente preguntan los transportistas.</h2>
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
        <section className="block final">
          <div className="wrap">
            <div className="final-inner">
              <div>
                <div className="eyebrow" style={{ color: 'rgba(243,237,226,0.55)', marginBottom: 24 }}>
                  <span className="dot" />
                  Empieza ahora
                </div>
                <h2 className="h-section" style={{ maxWidth: '16ch' }}>
                  ¿Listo para recibir<br /><em>tu primer pedido?</em>
                </h2>
                <p className="lede" style={{ marginTop: 24 }}>
                  Regístrate gratis en minutos y empieza a cotizar mudanzas.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <Link href="#registro" className="btn btn-primary">Registrar mi empresa <Arrow className="arrow" /></Link>
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
