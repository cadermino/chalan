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

export function LandingNav() {
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
              <Link href="/como-funciona">Cómo funciona</Link>
              <Link href="/#flota">Flota</Link>
              <Link href="/fletes-peru">Rutas</Link>
              <Link href="/blog">Blog</Link>
              <Link href="/preguntas-frecuentes">Preguntas</Link>
              <span className="sep" aria-hidden />
              <Link href="/register-login" style={{ opacity: 0.65 }}>Ingresar</Link>
              <Link href="https://wa.me/51972643007" target="_blank" rel="noopener" aria-label="Contáctanos por WhatsApp" style={{ opacity: 0.85 }}>WhatsApp</Link>
              <Link href="/order/step-one" className="btn btn-primary">Cotizar <Arrow className="arrow" /></Link>
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
                <Link href="/como-funciona" onClick={close}>Cómo funciona</Link>
                <Link href="/#flota" onClick={close}>Flota</Link>
                <Link href="/fletes-peru" onClick={close}>Rutas</Link>
                <Link href="/blog" onClick={close}>Blog</Link>
                <Link href="/preguntas-frecuentes" onClick={close}>Preguntas</Link>
                <div className="nav-mobile-sep" />
                <Link href="/register-login" onClick={close} style={{ opacity: 0.65 }}>Ingresar</Link>
                <Link href="https://wa.me/51972643007" target="_blank" rel="noopener" onClick={close} style={{ opacity: 0.85 }}>WhatsApp</Link>
                <Link href="/order/step-one" className="btn btn-primary nav-mobile-cta" onClick={close}>
                  Cotizar <Arrow className="arrow" />
                </Link>
              </div>
            </div>
          )}
        </header>
      </div>
    </>
  )
}
