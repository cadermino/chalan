import Link from 'next/link'
import Image from 'next/image'
import '../app/landing.css'

export function LandingFooter() {
  const year = new Date().getFullYear()
  return (
    <div className="chalan-landing">
      <footer className="foot">
        <div className="wrap">
          <div className="foot-row">
            <div>
              <div className="brand" style={{ marginBottom: 16 }}>
                <Image src="/logo_chalan.png" alt="Chalán" height={36} width={135} style={{ height: 36, width: 'auto' }} />
                <span className="brand-tld">.pe</span>
              </div>
              <p style={{ color: 'var(--ink-soft)', maxWidth: '36ch', lineHeight: 1.55 }}>
                Plataforma peruana de mudanzas y fletes. Operamos en 23 ciudades del país.
              </p>
            </div>
            <div>
              <h4>Servicios</h4>
              <ul>
                <li><Link href="/como-funciona">Cómo funciona</Link></li>
                <li><Link href="/mudanzas-lima">Mudanzas en Lima</Link></li>
                <li><Link href="/mudanzas-huancayo">Mudanzas en Huancayo</Link></li>
                <li><Link href="/fletes-peru">Fletes en Perú</Link></li>
                <li><Link href="/order/step-one">Cotizar</Link></li>
              </ul>
            </div>
            <div>
              <h4>Blog</h4>
              <ul>
                <li><Link href="/blog/cuanto-cuesta-una-mudanza-en-lima">Precio mudanza Lima</Link></li>
                <li><Link href="/blog/tips-para-mudarte-sin-estres">Tips para mudarte</Link></li>
                <li><Link href="/blog/cuanto-cuesta-un-flete-en-peru">Precio fletes Perú</Link></li>
                <li><Link href="/blog">Ver todos →</Link></li>
              </ul>
            </div>
            <div>
              <h4>Empresa</h4>
              <ul>
                <li><Link href="/nosotros">Nosotros</Link></li>
                <li><Link href="/contacto">Contacto</Link></li>
                <li><Link href="/preguntas-frecuentes">Preguntas frecuentes</Link></li>
                <li><Link href="/reviews">Reseñas</Link></li>
              </ul>
            </div>
            <div>
              <h4>Legal</h4>
              <ul>
                <li><Link href="/terminos-y-condiciones">Términos y condiciones</Link></li>
                <li><Link href="/aviso-de-privacidad">Aviso de privacidad</Link></li>
              </ul>
            </div>
            <div>
              <h4>Síguenos</h4>
              <ul>
                <li>
                  <Link href="https://www.facebook.com/ChalanMudanzas" target="_blank" rel="noopener noreferrer">
                    Facebook
                  </Link>
                </li>
                <li>
                  <Link href="https://wa.me/51972643007" target="_blank" rel="noopener">
                    WhatsApp
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="legal">
            <span>© {year} chalan.pe — Lima, Perú</span>
            <span>Hecho a mano, no con plantilla</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
