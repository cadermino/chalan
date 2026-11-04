import type { Metadata } from 'next'
import Link from 'next/link'
import { instrumentSerif, interTight, jetbrainsMono } from '@/lib/fonts'
import { LandingNav } from '@/components/LandingNav'
import { LandingFooter } from '@/components/LandingFooter'
import { PROFESSIONALS } from '@/lib/professionals'
import '../landing.css'

// Índice de los oficios que se pueden registrar (lib/professionals.ts). Los
// transportistas tienen su propia página: piden otros documentos.

export const metadata: Metadata = {
  title: 'Trabaja con Chalán: pintores, armadores y más en Lima | Chalán',
  description:
    'Pintores, aplicadores de microcemento, instaladores de porcelanato, armadores de muebles y embaladores: regístrate gratis en Chalán y recibe pedidos de clientes en Lima.',
  alternates: { canonical: '/profesionales' },
  openGraph: {
    title: 'Trabaja con Chalán: recibe pedidos de clientes en Lima',
    description: 'Regístrate gratis y recibe por WhatsApp pedidos de tu oficio. Tú pones tu precio.',
    url: 'https://chalan.pe/profesionales',
  },
}

export default function Professionals() {
  const fontVars = [instrumentSerif.variable, interTight.variable, jetbrainsMono.variable].join(' ')
  const trades = [
    ...PROFESSIONALS.map((p) => ({ href: `/profesionales/${p.slug}`, name: p.plural, body: p.lede })),
    {
      href: '/transportistas',
      name: 'transportistas',
      body: 'Si tienes un camión o una furgoneta, recibe pedidos de mudanzas y fletes.',
    },
  ]

  return (
    <>
      <LandingNav />
      <main id="main-content" className={`chalan-landing ${fontVars}`}>
        <section className="hero">
          <div className="wrap">
            <div className="eyebrow" style={{ marginBottom: 36 }}>
              <span className="dot" />
              Profesionales — trabaja con Chalán
            </div>
            <div className="hero-grid">
              <h1 className="h-display">
                <span className="line">Clientes nuevos.</span>
                <span className="line indent"><em>Tu precio.</em></span>
              </h1>
            </div>
            <p className="lede" style={{ marginTop: 24, maxWidth: '58ch' }}>
              Clientes de Lima piden en Chalán a quien les pinte, les arme los muebles o les instale el piso.
              Si es tu oficio y trabajas por tu cuenta, regístrate gratis y te avisamos de cada pedido.
            </p>
          </div>
        </section>

        <section className="block">
          <div className="wrap">
            <div className="section-head">
              <div className="num">01 / Oficios</div>
              <h2 className="h-section">Elige el tuyo.</h2>
            </div>
            <div className="steps">
              {trades.map((trade, i) => (
                <Link className="step" key={trade.href} href={trade.href} style={{ textDecoration: 'none' }}>
                  <div className="step-no"><span className="acc">●</span>{String(i + 1).padStart(2, '0')}</div>
                  <h3>{trade.name.charAt(0).toUpperCase() + trade.name.slice(1)} →</h3>
                  <p>{trade.body}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <LandingFooter />
      </main>
    </>
  )
}
