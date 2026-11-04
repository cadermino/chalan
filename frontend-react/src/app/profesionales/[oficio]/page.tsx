import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { instrumentSerif, interTight, jetbrainsMono } from '@/lib/fonts'
import { LandingNav } from '@/components/LandingNav'
import { LandingFooter } from '@/components/LandingFooter'
import { CarrierSignupForm } from '@/components/CarrierSignupForm'
import { COMMON_FAQ, PRO_STEPS, PROFESSIONALS, professionalBySlug } from '@/lib/professionals'
import '../../landing.css'

// Un oficio por página (lib/professionals.ts), todas con la misma forma que
// /transportistas. El formulario manda el código del servicio, así la empresa
// nace haciendo solo eso.

export const dynamicParams = false

export function generateStaticParams() {
  return PROFESSIONALS.map((p) => ({ oficio: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ oficio: string }> }): Promise<Metadata> {
  const pro = professionalBySlug((await params).oficio)
  if (!pro) return {}
  const path = `/profesionales/${pro.slug}`
  return {
    title: pro.title,
    description: pro.description,
    keywords: pro.keywords,
    alternates: { canonical: path },
    openGraph: { title: pro.title, description: pro.description, url: `https://chalan.pe${path}` },
  }
}

export default async function ProfessionalPage({ params }: { params: Promise<{ oficio: string }> }) {
  const pro = professionalBySlug((await params).oficio)
  if (!pro) notFound()
  const fontVars = [instrumentSerif.variable, interTight.variable, jetbrainsMono.variable].join(' ')
  const faq = [...pro.faq, ...COMMON_FAQ]
  const plural = pro.plural.charAt(0).toUpperCase() + pro.plural.slice(1)

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://chalan.pe' },
        { '@type': 'ListItem', position: 2, name: 'Profesionales', item: 'https://chalan.pe/profesionales' },
        { '@type': 'ListItem', position: 3, name: plural, item: `https://chalan.pe/profesionales/${pro.slug}` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ]

  return (
    <>
      <LandingNav />
      <main id="main-content" className={`chalan-landing ${fontVars}`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        {/* ── HERO ── */}
        <section className="hero">
          <div className="wrap">
            <div className="eyebrow" style={{ marginBottom: 36 }}>
              <span className="dot" />
              {plural} — trabaja con Chalán
            </div>

            <div className="hero-grid">
              <h1 className="h-display">
                <span className="line">{pro.heroLines[0]}</span>
                <span className="line indent"><em>{pro.heroLines[1]}</em></span>
                <span className="line right" style={{ fontFamily: 'var(--sans)', fontSize: '0.32em', fontWeight: 400, letterSpacing: '-0.01em', lineHeight: 1.2, color: 'var(--ink-soft)', marginTop: 18, maxWidth: '24ch', marginLeft: 'auto' }}>
                  {pro.lede}
                </span>
              </h1>
              <div className="hero-meta" id="registro">
                <CarrierSignupForm service={pro.service} />
              </div>
            </div>
          </div>
        </section>

        {/* ── QUÉ PIDEN ── */}
        <section className="block" id="pedidos">
          <div className="wrap">
            <div className="section-head">
              <div className="num">01 / Pedidos</div>
              <h2 className="h-section">Lo que piden<br />los clientes.</h2>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', columnGap: 32 }}>
              {pro.jobs.map((job) => (
                <li key={job} style={{ borderTop: '1px solid var(--line)', padding: '16px 0', fontSize: 17, color: 'var(--ink-strong)' }}>
                  <span style={{ color: 'var(--ch-accent)', marginRight: 10 }}>●</span>{job}
                </li>
              ))}
            </ul>
            <p style={{ marginTop: 24, fontSize: 15, lineHeight: 1.55, color: 'var(--ink-soft)', maxWidth: '62ch' }}>
              Cada pedido te llega con {pro.requestBrings}. Lo ves antes de cotizar: no hace falta ir
              a ver el trabajo para darle un precio.
            </p>
          </div>
        </section>

        {/* ── CÓMO FUNCIONA ── */}
        <section className="block" id="como">
          <div className="wrap">
            <div className="section-head">
              <div className="num">02 / Proceso</div>
              <h2 className="h-section">De registrarte<br />a cobrar tu primer trabajo.</h2>
            </div>
            <div className="steps">
              {PRO_STEPS.map((s) => (
                <div className="step" key={s.n}>
                  <div className="step-no"><span className="acc">●</span>{s.n}</div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 24, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mute)', letterSpacing: '0.06em' }}>
              * Tu precio es tuyo completo: la comisión de Chalán la paga el cliente encima, como reserva.
            </p>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="block" id="faq">
          <div className="wrap">
            <div className="section-head">
              <div className="num">03 / Preguntas</div>
              <h2 className="h-section">Lo que preguntan<br />los {pro.plural}.</h2>
            </div>
            <div>
              {faq.map((f, i) => (
                <details className="faq-item" key={f.q} open={i === 0}>
                  <summary>
                    <h3>{f.q}</h3>
                    <span className="plus">+</span>
                  </summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
            <p style={{ marginTop: 24, fontSize: 14, color: 'var(--ink-soft)' }}>
              ¿Buscas un {pro.singular} y no trabajo? Cotiza en{' '}
              <Link href={pro.customerPath} style={{ color: 'var(--ch-accent)' }}>esta página</Link>.
            </p>
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
                  Regístrate gratis<br /><em>en dos minutos.</em>
                </h2>
                <p className="lede" style={{ marginTop: 24 }}>
                  Sin cuota, sin mensualidad y sin comisión a tu precio.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <Link href="#registro" className="btn btn-primary">Registrarme</Link>
                <Link href="/profesionales" className="btn btn-ghost">Otros oficios</Link>
              </div>
            </div>
          </div>
        </section>

        <LandingFooter />
      </main>
    </>
  )
}
