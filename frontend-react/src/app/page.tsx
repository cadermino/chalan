import Link from "next/link";
import Image from "next/image";
import { ScrollEffects } from "@/components/ScrollEffects";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "MovingCompany",
  name: "Chalán",
  url: "https://chalan.pe",
  logo: "https://chalan-public.s3.amazonaws.com/home/truck-list-fb.png",
  description:
    "En Chalán te ayudamos a encontrar el vehículo ideal para tu mudanza o flete. Compara precios, elige tu movilidad y múdate fácil.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Lima",
    addressCountry: "PE",
  },
  areaServed: {
    "@type": "Country",
    name: "Perú",
  },
  serviceType: ["Mudanzas", "Fletes", "Transporte de carga"],
  priceRange: "$$",
};

export default function Home() {
  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ScrollEffects />
      {/* ========== NAVBAR ========== */}
      <nav
        id="main-navbar"
        className="navbar fixed top-0 left-0 right-0 z-50 nav-animate"
      >
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-3xl font-bold text-white tracking-tight">
              Chal<span className="text-amber-400">á</span>n
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/contacto"
              className="text-white/80 hover:text-white transition-colors hidden sm:inline font-medium"
            >
              Contacto
            </Link>
            <Link
              href="/nosotros"
              className="text-white/80 hover:text-white transition-colors hidden sm:inline font-medium"
            >
              Nosotros
            </Link>
            <Link
              href="/register-login"
              className="text-white/80 hover:text-white transition-colors hidden md:inline font-medium"
            >
              Regístrate
            </Link>
            <Link
              href="/order/step-one"
              className="cta-button !py-2.5 !px-6 !text-sm"
              style={{ animation: "none" }}
            >
              Cotizar
            </Link>
          </div>
        </div>
      </nav>

      {/* ========== HERO SECTION (PARALLAX) ========== */}
      <section className="parallax-section" style={{ minHeight: "100vh" }}>
        <div
          className="parallax-bg"
          style={{ backgroundImage: "url('/images/hero-bg.png')" }}
        />
        <div className="parallax-content">
          <div className="container mx-auto px-6 text-center pt-24">
            <h1
              className="hero-title text-white font-extrabold leading-tight mb-6"
              style={{ fontSize: "clamp(2.5rem, 5vw, 4.5rem)" }}
            >
              En Chalán te ayudamos a<br />
              encontrar el vehículo ideal
              <br />
              <span className="text-amber-400">
                para tu mudanza o flete
              </span>
            </h1>
            <p className="hero-subtitle text-white/85 text-xl md:text-2xl max-w-3xl mx-auto mb-10 font-light leading-relaxed">
              Chalán te muestra una lista de vehículos según tamaño y precio.
              <br className="hidden md:inline" /> Escoge el que más te
              convenga.
            </p>
            <div className="hero-cta flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/order/step-one"
                className="cta-button text-lg"
              >
                Ver precios
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/contacto"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full border-2 border-white/30 text-white font-medium hover:bg-white/10 transition-all text-lg"
              >
                Contáctanos
              </Link>
            </div>

            {/* Scroll indicator */}
            <div className="scroll-indicator mt-16 flex flex-col items-center gap-2 opacity-60">
              <span className="text-white/60 text-sm font-medium tracking-wider uppercase">
                Descubre más
              </span>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ========== TESTIMONIALS (PARALLAX) ========== */}
      <section
        className="parallax-section"
        style={{ minHeight: "auto", padding: "6rem 0" }}
      >
        <div
          className="parallax-bg"
          style={{
            backgroundImage: "url('/images/testimonials-bg.png')",
          }}
        />
        <div className="parallax-content">
          <div className="container mx-auto px-6">
            <div className="reveal text-center mb-14">
              <span className="inline-block px-4 py-1.5 rounded-full bg-amber-400/20 text-amber-300 text-sm font-semibold tracking-wide uppercase mb-4">
                Testimonios
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-white">
                Nuestros clientes nos recomiendan
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {/* Testimonial 1 - Sofía */}
              <div className="reveal stagger-1 glass-card p-8">
                <div className="flex items-center gap-4 mb-4">
                  <Image
                    src="/images/sofia.jpg"
                    alt="Sofía P."
                    width={56}
                    height={56}
                    className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                  />
                  <div>
                    <p className="text-white font-bold">Sofía P.</p>
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="#fbbf24"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="testimonial-quote">
                  <p className="text-white/90 leading-relaxed text-lg">
                    Suuuuuuper contenta con el servicio!!!! Se ajustó
                    perfectamente a mis necesidades y a muy buen precio!! Super
                    super recomendable!!!
                  </p>
                </div>
              </div>

              {/* Testimonial 2 - Demian */}
              <div className="reveal stagger-2 glass-card p-8">
                <div className="flex items-center gap-4 mb-4">
                  <Image
                    src="/images/demian.jpg"
                    alt="Demian M."
                    width={56}
                    height={56}
                    className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                  />
                  <div>
                    <p className="text-white font-bold">Demian M.</p>
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="#fbbf24"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="testimonial-quote">
                  <p className="text-white/90 leading-relaxed text-lg">
                    Pude elegir entre varias opciones y precios. El servicio fue
                    bueno y los chicos se esforzaron. No hubo ningún incidente
                    y recomiendo el servicio.
                  </p>
                </div>
              </div>

              {/* Testimonial 3 - Daniel */}
              <div className="reveal stagger-3 glass-card p-8">
                <div className="flex items-center gap-4 mb-4">
                  <Image
                    src="/images/daniel.jpg"
                    alt="Daniel N."
                    width={56}
                    height={56}
                    className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                  />
                  <div>
                    <p className="text-white font-bold">Daniel N.</p>
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="#fbbf24"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="testimonial-quote">
                  <p className="text-white/90 leading-relaxed text-lg">
                    Su plataforma es muy cómoda, permite cotizar y agendar tu
                    viaje fácilmente.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== 4 STEPS SECTION ========== */}
      <section className="py-24 bg-gradient-to-b from-slate-50 to-white relative overflow-hidden">
        {/* Decorative elements */}
        <div
          className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-5"
          style={{
            background:
              "radial-gradient(circle, var(--primary) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-5"
          style={{
            background:
              "radial-gradient(circle, var(--accent) 0%, transparent 70%)",
          }}
        />

        <div className="container mx-auto px-6 relative z-10">
          <div className="reveal text-center mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-sm font-semibold tracking-wide uppercase mb-4">
              Cómo funciona
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Múdate en sólo{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 to-amber-500">
                4 pasos
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Step 1 */}
            <div className="reveal stagger-1 glass-card-light p-8 flex gap-6 items-start relative">
              <div className="step-number">1</div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Indícanos las direcciones
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Para cotizar con mayor precisión, necesitamos saber desde
                  donde y a qué lugar te vamos a mover.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="reveal stagger-2 glass-card-light p-8 flex gap-6 items-start relative">
              <div className="step-number">2</div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Fecha y hora de tu mudanza
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Ingresa la fecha y hora en la que vamos por tus cosas.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="reveal stagger-3 glass-card-light p-8 flex gap-6 items-start relative">
              <div className="step-number">3</div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Escoge la movilidad
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Enviamos los datos de tu mudanza a nuestros chalanes y una
                  vez que tengan su cotización te mostraremos la lista de
                  precios.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="reveal stagger-4 glass-card-light p-8 flex gap-6 items-start relative">
              <div className="step-number">4</div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Opciones de pago
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Contamos con dos opciones de pago, en efectivo y con
                  tarjeta.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== VEHICLES / CTA SECTION (PARALLAX) ========== */}
      <section
        className="parallax-section relative"
        style={{ minHeight: "auto", padding: "0" }}
      >
        <div
          className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900"
        />
        <div className="parallax-content py-20">
          <div className="container mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
              {/* Left: Image */}
              <div className="reveal-left">
                <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                  <Image
                    src="/images/vehicles-bg.png"
                    alt="Vehículos de mudanza disponibles en Chalán"
                    width={600}
                    height={400}
                    className="w-full h-auto"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/30 to-transparent" />
                </div>
              </div>

              {/* Right: CTA */}
              <div className="reveal-right text-center md:text-left">
                <span className="inline-block px-4 py-1.5 rounded-full bg-amber-400/20 text-amber-300 text-sm font-semibold tracking-wide uppercase mb-4">
                  Nuestra flota
                </span>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                  Elige el vehículo que más te{" "}
                  <span className="text-amber-400">acomode</span>
                </h2>
                <p className="text-white/70 text-lg mb-8 leading-relaxed">
                  Desde pequeñas mudanzas hasta fletes de gran escala,
                  tenemos el vehículo perfecto para ti. Compara opciones y
                  precios en un solo lugar.
                </p>
                <Link
                  href="/order/step-one"
                  className="cta-button text-lg"
                >
                  Cotiza ahora
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="bg-gray-950 text-white pt-16 pb-8">
        <div className="container mx-auto px-6">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-10 mb-12">
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
                  <Link
                    href="/nosotros"
                    className="footer-link"
                  >
                    Nosotros
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contacto"
                    className="footer-link"
                  >
                    Contacto
                  </Link>
                </li>
                <li>
                  <Link
                    href="/preguntas-frecuentes"
                    className="footer-link"
                  >
                    Preguntas frecuentes
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
                  <Link
                    href="/aviso-de-privacidad"
                    className="footer-link"
                  >
                    Aviso de privacidad
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
    </main>
  );
}
