import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-gray-950 text-white pt-16 pb-8" role="contentinfo">
      <div className="container mx-auto px-6">
        <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <h3 className="text-2xl font-bold mb-4">
              Chal<span className="text-amber-400">á</span>n
            </h3>
            <p className="text-white/50 leading-relaxed text-sm">
              En Chalán te ayudamos a encontrar el vehículo ideal para tu
              mudanza o flete en Perú.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white/40 mb-4">
              Enlaces
            </h4>
            <ul className="space-y-3">
              <li>
                <Link href="/nosotros" className="footer-link">
                  Nosotros
                </Link>
              </li>
              <li>
                <Link href="/contacto" className="footer-link">
                  Contacto
                </Link>
              </li>
              <li>
                <Link href="/preguntas-frecuentes" className="footer-link">
                  Preguntas frecuentes
                </Link>
              </li>
              <li>
                <Link href="/reviews" className="footer-link">
                  Reseñas
                </Link>
              </li>
            </ul>
          </div>

          {/* Servicios */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white/40 mb-4">
              Servicios
            </h4>
            <ul className="space-y-3">
              <li>
                <Link href="/mudanzas-lima" className="footer-link">
                  Mudanzas en Lima
                </Link>
              </li>
              <li>
                <Link href="/mudanzas-huancayo" className="footer-link">
                  Mudanzas en Huancayo
                </Link>
              </li>
              <li>
                <Link href="/fletes-peru" className="footer-link">
                  Fletes en Perú
                </Link>
              </li>
              <li>
                <Link href="/como-funciona" className="footer-link">
                  ¿Cómo funciona?
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white/40 mb-4">
              Legal
            </h4>
            <ul className="space-y-3">
              <li>
                <Link href="/aviso-de-privacidad" className="footer-link">
                  Aviso de privacidad
                </Link>
              </li>
              <li>
                <Link href="/terminos-y-condiciones" className="footer-link">
                  Términos y condiciones
                </Link>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white/40 mb-4">
              Síguenos
            </h4>
            <div className="flex gap-3">
              <Link
                href="https://www.facebook.com/ChalanMudanzas"
                className="social-icon"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
                </svg>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-white/30 text-sm">
            &copy; {new Date().getFullYear()} Chalán. Todos los derechos
            reservados.
          </p>
          <p className="text-white/20 text-xs">
            Hecho con ❤️ en Perú
          </p>
        </div>
      </div>
    </footer>
  );
}
