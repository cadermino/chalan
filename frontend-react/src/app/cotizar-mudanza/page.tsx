import Link from "next/link";
import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/Breadcrumbs";
import { LandingFooter } from "@/components/LandingFooter";
import { LandingNav } from "@/components/LandingNav";
import { QuoteWidget } from "@/components/QuoteWidget";

export const metadata: Metadata = {
  title: "Cotizar mudanza online gratis en minutos | Chalán",
  description:
    "Cotiza tu mudanza online gratis y sin llamadas. Ingresa origen y destino, compara precios de vehículos y reserva en minutos. Cotización de mudanzas al instante en Perú.",
  keywords:
    "cotizar mudanza, cotización de mudanzas, cotizar mudanza online, cotización mudanza gratis, cotizar mudanza en linea, cotizar flete, cotización mudanza lima",
  alternates: {
    canonical: "/cotizar-mudanza",
  },
  openGraph: {
    title: "Cotizar mudanza online gratis | Chalán",
    description:
      "Cotiza tu mudanza online gratis y sin llamadas. Compara precios de vehículos y reserva en minutos.",
    url: "https://chalan.pe/cotizar-mudanza",
  },
};

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "MovingCompany",
  name: "Chalán - Cotización de mudanzas online",
  url: "https://chalan.pe/cotizar-mudanza",
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
    "@type": "Country",
    name: "Perú",
  },
  serviceType: ["Cotización de mudanzas", "Cotización de fletes", "Mudanzas", "Fletes"],
  priceRange: "$$",
};

const faqs = [
  { q: "¿Cotizar una mudanza tiene algún costo?", a: "No. Cotizar en Chalán es completamente gratis y sin compromiso. Solo pagas si decides reservar el servicio." },
  { q: "¿La cotización es exacta o es un estimado?", a: "Te mostramos precios reales de los vehículos disponibles según tu ruta y el tamaño que elijas, no un estimado vago. El precio que ves es el que pagas, sin sorpresas." },
  { q: "¿Necesito registrarme para cotizar?", a: "No necesitas registrarte para ver los precios. Ingresas origen, destino y fecha, y al instante te mostramos las opciones disponibles." },
  { q: "¿En cuánto tiempo obtengo mi cotización?", a: "Al instante. En cuanto ingresas las direcciones y la fecha, te mostramos la lista de vehículos con sus precios en segundos, sin llamadas ni esperas." },
  { q: "¿Puedo cotizar tanto mudanzas como fletes?", a: "Sí. Puedes cotizar mudanzas completas de casa o departamento, fletes de carga y traslados dentro de Lima o interprovinciales por todo el Perú." },
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

export default function CotizarMudanza() {
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
            { name: "Cotizar mudanza", url: "https://chalan.pe/cotizar-mudanza" },
          ]}
        />

        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Cotiza tu mudanza online, gratis y en minutos
        </h1>
        <p className="text-lg text-gray-600 mb-10">
          Obtén la cotización de tu mudanza o flete al instante. Ingresa el origen y el destino,
          elige la fecha y compara precios reales de vehículos disponibles. Sin llamadas, sin
          esperas y sin compromiso.
        </p>

        {/* Quote widget — arriba, es el objetivo de la página */}
        <div className="mb-14">
          <p className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Cotiza tu mudanza ahora</p>
          <QuoteWidget theme="light" />
        </div>

        {/* Cómo cotizar */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            ¿Cómo cotizar tu mudanza online?
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              { step: "1", title: "Ingresa tus direcciones", desc: "Escribe desde dónde y hacia dónde te mudas. Calculamos la distancia automáticamente." },
              { step: "2", title: "Elige fecha y hora", desc: "Indica cuándo necesitas el servicio, con anticipación o para el mismo día." },
              { step: "3", title: "Compara precios", desc: "Te mostramos los vehículos disponibles con sus precios reales al instante." },
              { step: "4", title: "Reserva y listo", desc: "Elige la opción que más te convenga, paga en efectivo o con tarjeta y confirma." },
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
            ¿Por qué cotizar tu mudanza con Chalán?
          </h2>
          <div className="space-y-4 text-gray-700 leading-relaxed">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-2">Cotización gratis y al instante</h3>
              <p>Ves los precios en segundos, sin llamar a nadie ni esperar respuesta. Cotizar no tiene ningún costo ni compromiso.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-2">Precios reales, no estimados</h3>
              <p>Comparas opciones de vehículos con su precio real según tu ruta y volumen. El precio que ves es el que pagas, sin cobros ocultos.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-2">Transportistas verificados</h3>
              <p>Trabajamos con transportistas confiables y con experiencia. Puedes ver reseñas y calificaciones antes de elegir.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-2">Mudanzas y fletes por todo el Perú</h3>
              <p>Cotiza mudanzas locales en Lima, traslados entre distritos o fletes interprovinciales a cualquier ciudad del país.</p>
            </div>
          </div>
        </section>

        {/* Qué necesitas */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            ¿Qué necesitas para cotizar?
          </h2>
          <ul className="space-y-2 text-gray-700">
            <li>• La dirección de <strong>origen</strong> (desde dónde te mudas).</li>
            <li>• La dirección de <strong>destino</strong> (hacia dónde te mudas).</li>
            <li>• La <strong>fecha</strong> aproximada del servicio.</li>
            <li>• Una idea del <strong>volumen</strong> de tus cosas para elegir el vehículo adecuado.</li>
          </ul>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Preguntas frecuentes sobre cotizar una mudanza
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
                <div className="px-6 pb-5 text-gray-600 leading-relaxed">{faq.a}</div>
              </details>
            ))}
          </div>
        </section>

        {/* Enlaces internos */}
        <section className="mb-12">
          <p className="text-gray-600">
            ¿Buscas algo más específico? Revisa nuestro servicio de{" "}
            <Link href="/mudanzas-lima" className="text-indigo-600 hover:underline">mudanzas en Lima</Link>,{" "}
            <Link href="/mudanzas-huancayo" className="text-indigo-600 hover:underline">mudanzas en Huancayo</Link>{" "}
            o los <Link href="/fletes-peru" className="text-indigo-600 hover:underline">fletes en todo el Perú</Link>.
          </p>
        </section>

        {/* Bottom CTA */}
        <div className="bg-amber-50 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Cotiza tu mudanza ahora mismo
          </h2>
          <p className="text-gray-600 mb-4">
            Gratis, sin llamadas y en minutos.
          </p>
          <Link
            href="/order/step-one"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-indigo-950 text-white font-semibold hover:bg-indigo-900 transition-colors"
          >
            Cotizar mudanza gratis
          </Link>
        </div>
      </div>
      <LandingFooter />
    </main>
  );
}
