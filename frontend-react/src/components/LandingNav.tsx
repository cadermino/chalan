'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Inter_Tight } from 'next/font/google'
import '../app/landing.css'

const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter-tight',
  display: 'swap',
})

function Arrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

interface NavLink {
  label: string
  href: string
  external?: boolean
  muted?: boolean
}

interface NavCta {
  label: string
  href: string
  external?: boolean
  icon?: React.ReactNode
}

interface LandingNavProps {
  links?: NavLink[]
  cta?: NavCta
}

const DEFAULT_LINKS: NavLink[] = [
  { label: 'Cómo funciona', href: '/como-funciona' },
  { label: 'Flota', href: '/#flota' },
  { label: 'Rutas', href: '/fletes-peru' },
  { label: 'Blog', href: '/blog' },
  { label: 'Preguntas', href: '/preguntas-frecuentes' },
  { label: 'Ingresar', href: '/register-login', muted: true },
  { label: 'WhatsApp', href: 'https://wa.me/51972643007', external: true },
]

const DEFAULT_CTA: NavCta = {
  label: 'Cotizar',
  href: '/order/step-one',
}

export function LandingNav({ links = DEFAULT_LINKS, cta = DEFAULT_CTA }: LandingNavProps) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <>
      <div aria-hidden style={{ height: 72 }} />
      <div className={`chalan-landing ${interTight.variable}`} style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 }}>
        <header className="topbar" style={{ position: 'static' }}>
          <div className="wrap topbar-inner">
            <Link href="/" className="brand" aria-label="Chalán" onClick={close}>
              <Image src="/logo_chalan.png" alt="Chalán" height={32} width={120} style={{ height: 32, width: 'auto' }} priority />
              <span className="brand-tld">.pe</span>
            </Link>

            {/* Desktop */}
            <nav className="nav nav-links" aria-label="Navegación principal">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  {...(l.external ? { target: '_blank', rel: 'noopener' } : {})}
                  style={l.muted ? { opacity: 0.65 } : undefined}
                >
                  {l.label}
                </Link>
              ))}
              <span className="sep" aria-hidden />
              <Link
                href={cta.href}
                className="btn btn-primary"
                {...(cta.external ? { target: '_blank', rel: 'noopener' } : {})}
              >
                {cta.icon}
                {cta.label}
                <Arrow className="arrow" />
              </Link>
            </nav>

            {/* Hamburger */}
            <button
              className="nav-hamburger"
              onClick={() => setOpen(o => !o)}
              aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={open}
            >
              {open ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>

          {/* Mobile menu */}
          {open && (
            <div className="nav-mobile" role="dialog" aria-label="Menú de navegación">
              <div className="wrap">
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={close}
                    {...(l.external ? { target: '_blank', rel: 'noopener' } : {})}
                    style={l.muted ? { opacity: 0.65 } : undefined}
                  >
                    {l.label}
                  </Link>
                ))}
                <div className="nav-mobile-sep" />
                <Link
                  href={cta.href}
                  className="btn btn-primary nav-mobile-cta"
                  onClick={close}
                  {...(cta.external ? { target: '_blank', rel: 'noopener' } : {})}
                >
                  {cta.icon}
                  {cta.label}
                  <Arrow className="arrow" />
                </Link>
              </div>
            </div>
          )}
        </header>
      </div>
    </>
  )
}
