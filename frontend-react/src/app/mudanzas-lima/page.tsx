import Link from "next/link";
import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/Breadcrumbs";
import { LandingFooter } from "@/components/LandingFooter";
import { LandingNav } from "@/components/LandingNav";
import { QuoteWidget } from "@/components/QuoteWidget";
import { Testimonials } from "@/components/Testimonials";

export const metadata: Metadata = {
  title: "Servicio de mudanza en Lima, grande o pequeña | Chalán",
  description:
    "Contrata tu mudanza en Lima con transportistas verificados. Desde unas cajas hasta una casa completa: comparas, eliges y reservas sin llamar a nadie.",
  keywords:
    "servicio de mudanza en lima, servicio de mudanza lima, servicio de mudanzas en lima, mudanza pequeña, mudanzas pequeñas, mudanzas economicas, empresa de mudanzas lima, mudanzas miraflores, mudanzas surco, mudanzas san isidro",
  alternates: {
    canonical: "/mudanzas-lima",
  },
  openGraph: {
    title: "Servicio de mudanza en Lima - Chalán",
    description:
      "Contrata tu mudanza en Lima con transportistas verificados, desde unas cajas hasta una casa completa.",
    url: "https://chalan.pe/mudanzas-lima",
  },
};

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "MovingCompany",
  name: "Chalán - Mudanzas en Lima",
  url: "https://chalan.pe/mudanzas-lima",
  telephone: "+51-972-643-007",
  email: "carlos.calderon@chalan.pe",
  image: "https://chalan-public.s3.amazonaws.com/home/truck-list-fb.png",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Lima",
    addressRegion: "Lima",
    addressCountry: "PE",
  },
  areaServed: {
    "@type": "City",
    name: "Lima",
    containedInPlace: {
      "@type": "Country",
      name: "Perú",
    },
  },
  serviceType: ["Servicio de mudanza", "Mudanzas pequeñas", "Mudanzas entre distritos", "Fletes en Lima"],
  priceRange: "$$",
};

const faqs = [
  {
    q: "¿Cuánto cuesta una mudanza en Lima?",
    a: "El precio depende de la distancia entre distritos y el tamaño del vehículo. Con Chalán puedes cotizar gratis y comparar precios al instante, o revisar precios reales por tamaño de vehículo en nuestra guía de precios.",
    render: (
      <>
        El precio depende de la distancia entre distritos y el tamaño del vehículo. Con Chalán
        puedes cotizar gratis y comparar precios al instante, o revisar precios reales por
        tamaño de vehículo en nuestra{" "}
        <Link href="/blog/cuanto-cuesta-una-mudanza-en-lima" className="text-indigo-700 underline">
          guía de precios
        </Link>.
      </>
    ),
  },
  { q: "¿Atienden mudanzas pequeñas?", a: "Sí. Una habitación, un estudio o unas cajas con un par de muebles se mueven en furgoneta o camión pequeño, y se cobran como un traslado chico, no como una mudanza completa." },
  { q: "¿Hacen mudanzas los fines de semana?", a: "Sí, operamos los 7 días de la semana incluyendo feriados." },
  { q: "¿Qué distritos cubren?", a: "Cubrimos todos los distritos de Lima Metropolitana, desde San Juan de Lurigancho hasta Chorrillos, Miraflores, La Molina y más." },
  { q: "¿Los transportistas ayudan a cargar?", a: "Sí, nuestros chalanes incluyen ayudantes para cargar y descargar tus pertenencias." },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: { "@type": "Answer", text: faq.a },
  })),
};

const districts = [
  "Miraflores",
  "San Isidro",
  "Surco",
  "La Molina",
  "San Borja",
  "Barranco",
  "Jesús María",
  "Lince",
  "Pueblo Libre",
  "Magdalena",
  "San Miguel",
  "Chorrillos",
  "Lima Cercado",
  "Breña",
  "Rímac",
  "Los Olivos",
  "San Martín de Porres",
  "Independencia",
  "Comas",
  "Ate",
  "Santa Anita",
  "La Victoria",
  "El Agustino",
  "San Juan de Lurigancho",
];

export default function MudanzasLima() {
  return (
    <main id="main-content" className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <LandingNav />

      <div className="container mx-auto px-6 py-16 max-w-4xl">
        <BreadcrumbJsonLd
          items={[
            { name: "Inicio", url: "https://chalan.pe" },
            { name: "Servicio de mudanza en Lima", url: "https://chalan.pe/mudanzas-lima" },
          ]}
        />

        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Servicio de mudanza en Lima
        </h1>
        <p className="text-lg text-gray-600 mb-10">
          Transportistas verificados en toda Lima Metropolitana, para mudanzas de
          cualquier tamaño: desde unas cajas y un par de muebles hasta una casa
          completa. Comparas, eliges y reservas sin llamar a nadie.
        </p>

        {/* CTA */}
        <div className="mb-12">
          <p className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Cotiza tu mudanza en Lima ahora</p>
          <QuoteWidget theme="light" />
        </div>

        {/* Cómo funciona */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            ¿Cómo funciona una mudanza con Chalán en Lima?
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              { step: "1", title: "Ingresa tus direcciones", desc: "Indica desde qué distrito y a qué distrito te mudas dentro de Lima." },
              { step: "2", title: "Elige fecha y hora", desc: "Selecciona cuándo necesitas que recojamos tus cosas." },
              { step: "3", title: "Compara vehículos", desc: "Te mostramos opciones de vehículos con precios según tu ruta y volumen." },
              { step: "4", title: "Confirma y listo", desc: "Paga en efectivo o con tarjeta. Tu chalán llega puntual." },
            ].map((item) => (
              <div key={item.step} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center mb-3">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Ventajas */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            ¿Por qué elegir Chalán para tu mudanza en Lima?
          </h2>
          <div className="space-y-4 text-gray-700 leading-relaxed">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-2">Precios transparentes</h3>
              <p>Comparas opciones de vehículos y ves los precios antes de reservar. Sin sorpresas ni cobros ocultos.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-2">Cobertura completa en Lima</h3>
              <p>Cubrimos todos los distritos de Lima Metropolitana. Mudanzas locales o entre distritos.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-2">Transportistas verificados</h3>
              <p>Trabajamos con chalanes confiables y con experiencia en mudanzas dentro de Lima.</p>
            </div>
          </div>
        </section>

        {/* Mudanzas pequeñas */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            ¿Mudanza pequeña? También
          </h2>
          <p className="text-gray-600 mb-4">
            No hace falta mudar una casa entera para contratar el servicio. Una
            habitación, un estudio o unas cajas con dos muebles entran en una
            furgoneta o un camión pequeño, y se cobran como lo que son: un
            traslado chico, no una mudanza completa.
          </p>
          <p className="text-gray-600 mb-4">
            Tres formas de que salga más barato cuando tienes poca cosa:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-gray-600 mb-4">
            <li>
              <strong className="text-gray-900">El vehículo justo.</strong>{" "}
              Pagar un camión grande a medio llenar es el error más caro. Mira{" "}
              <Link href="/blog/camion-de-mudanza-que-tamano-elegir" className="text-indigo-600 hover:underline">
                qué tamaño necesitas
              </Link>{" "}
              antes de reservar.
            </li>
            <li>
              <strong className="text-gray-900">Compartir el camión.</strong>{" "}
              Si tu carga no llena el vehículo, la{" "}
              <Link href="/blog/mudanza-compartida-como-ahorrar-en-tu-flete" className="text-indigo-600 hover:underline">
                mudanza compartida
              </Link>{" "}
              reparte el viaje y el costo con otra carga.
            </li>
            <li>
              <strong className="text-gray-900">Entre semana.</strong> De lunes a
              viernes hay más vehículos disponibles y los precios bajan.
            </li>
          </ul>
        </section>

        {/* Distritos */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Distritos con cobertura en Lima
          </h2>
          <div className="flex flex-wrap gap-2">
            {districts.map((d) => (
              <span
                key={d}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium"
              >
                {d}
              </span>
            ))}
          </div>
        </section>

        <Testimonials variant="light" />

        {/* FAQ local */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Preguntas frecuentes sobre mudanzas en Lima
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <summary className="flex items-center justify-between cursor-pointer px-6 py-5 font-semibold text-gray-900 hover:bg-gray-50 transition-colors">
                  {faq.q}
                  <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-5 text-gray-600 leading-relaxed">{faq.render ?? faq.a}</div>
              </details>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <div className="bg-amber-50 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            ¿Listo para tu mudanza en Lima?
          </h2>
          <p className="text-gray-600 mb-4">
            Cotiza gratis y compara precios en segundos.
          </p>
          <Link
            href="/order/step-one"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-indigo-950 text-white font-semibold hover:bg-indigo-900 transition-colors"
          >
            Cotizar ahora
          </Link>
        </div>
      </div>
      <LandingFooter />
    </main>
  );
}
