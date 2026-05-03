import Link from "next/link";
import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/Breadcrumbs";
import { LandingFooter } from "@/components/LandingFooter";
import { LandingNav } from "@/components/LandingNav";
import { QuoteWidget } from "@/components/QuoteWidget";

export const metadata: Metadata = {
  title: "Mudanzas en Huancayo - Precios y servicio confiable | Chalán",
  description:
    "Servicio de mudanzas en Huancayo y el Valle del Mantaro. Mudanzas locales y de Huancayo a Lima. Compara precios y reserva fácil.",
  keywords:
    "mudanzas huancayo, empresa mudanzas huancayo, mudanza huancayo lima, mudanza barata huancayo, fletes huancayo, mudanzas junín",
  alternates: {
    canonical: "/mudanzas-huancayo",
  },
  openGraph: {
    title: "Mudanzas en Huancayo - Chalán",
    description:
      "Servicio de mudanzas en Huancayo y el Valle del Mantaro. Compara precios y múdate fácil.",
    url: "https://chalan.pe/mudanzas-huancayo",
  },
};

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "MovingCompany",
  name: "Chalán - Mudanzas en Huancayo",
  url: "https://chalan.pe/mudanzas-huancayo",
  telephone: "+51-972-643-007",
  email: "carlos.calderon@chalan.pe",
  areaServed: {
    "@type": "City",
    name: "Huancayo",
    containedInPlace: {
      "@type": "AdministrativeArea",
      name: "Junín, Perú",
    },
  },
  serviceType: ["Mudanzas locales", "Mudanzas Huancayo-Lima", "Fletes en Huancayo"],
  priceRange: "$$",
};

const zones = [
  "Huancayo Centro",
  "El Tambo",
  "Chilca",
  "Pilcomayo",
  "San Agustín de Cajas",
  "Hualhuas",
  "San Jerónimo de Tunán",
  "Concepción",
  "Jauja",
  "Chupaca",
  "Sapallanga",
  "Huancán",
];

export default function MudanzasHuancayo() {
  return (
    <main id="main-content" className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <LandingNav />

      <div className="container mx-auto px-6 py-16 max-w-4xl">
        <BreadcrumbJsonLd
          items={[
            { name: "Inicio", url: "https://chalan.pe" },
            { name: "Mudanzas en Huancayo", url: "https://chalan.pe/mudanzas-huancayo" },
          ]}
        />

        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Mudanzas en Huancayo
        </h1>
        <p className="text-lg text-gray-600 mb-10">
          Servicio de mudanzas en Huancayo y el Valle del Mantaro. También
          realizamos mudanzas de Huancayo a Lima y viceversa.
        </p>

        {/* CTA */}
        <div className="mb-12">
          <p className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">Cotiza tu mudanza en Huancayo</p>
          <div className="chalan-landing">
            <QuoteWidget />
          </div>
        </div>

        {/* Cómo funciona */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            ¿Cómo funciona una mudanza con Chalán en Huancayo?
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              { step: "1", title: "Ingresa tus direcciones", desc: "Indica la dirección de origen y destino en Huancayo o ruta Huancayo-Lima." },
              { step: "2", title: "Elige fecha y hora", desc: "Selecciona cuándo necesitas el servicio de mudanza." },
              { step: "3", title: "Compara vehículos", desc: "Te mostramos opciones de vehículos con precios según tu ruta." },
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
            ¿Por qué elegir Chalán para tu mudanza en Huancayo?
          </h2>
          <div className="space-y-4 text-gray-700 leading-relaxed">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-2">Mudanzas locales y de larga distancia</h3>
              <p>Realizamos mudanzas dentro de Huancayo y el Valle del Mantaro, así como mudanzas Huancayo-Lima (aproximadamente 7 horas por carretera).</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-2">Precios competitivos</h3>
              <p>Compara distintos vehículos y elige el que se ajuste a tu presupuesto. Sin cobros ocultos.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-2">Transportistas con experiencia</h3>
              <p>Nuestros chalanes conocen las rutas y condiciones de la zona, incluyendo la carretera central.</p>
            </div>
          </div>
        </section>

        {/* Zonas */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Zonas con cobertura en Huancayo
          </h2>
          <div className="flex flex-wrap gap-2">
            {zones.map((z) => (
              <span
                key={z}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium"
              >
                {z}
              </span>
            ))}
          </div>
        </section>

        {/* Rutas populares */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Rutas populares desde Huancayo
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { route: "Huancayo → Lima", detail: "~7 horas por carretera central" },
              { route: "Huancayo → El Tambo", detail: "Mudanza local, ~15 min" },
              { route: "Huancayo → Chilca", detail: "Mudanza local, ~10 min" },
              { route: "Huancayo → Concepción", detail: "~30 min por la ruta del Mantaro" },
            ].map((r) => (
              <div key={r.route} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <p className="font-semibold text-gray-900">{r.route}</p>
                <p className="text-gray-500 text-sm">{r.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ local */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Preguntas frecuentes sobre mudanzas en Huancayo
          </h2>
          <div className="space-y-4">
            {[
              { q: "¿Cuánto cuesta una mudanza en Huancayo?", a: "Depende de la distancia y el tamaño del vehículo. Con Chalán puedes cotizar gratis y comparar precios al instante." },
              { q: "¿Hacen mudanzas de Huancayo a Lima?", a: "Sí, realizamos mudanzas de larga distancia entre Huancayo y Lima por la carretera central." },
              { q: "¿Operan en todo el Valle del Mantaro?", a: "Sí, cubrimos Huancayo, El Tambo, Chilca, Concepción, Jauja, Chupaca y alrededores." },
              { q: "¿Los transportistas ayudan a cargar?", a: "Sí, nuestros chalanes incluyen ayudantes para cargar y descargar tus pertenencias." },
            ].map((faq, i) => (
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

        {/* Bottom CTA */}
        <div className="bg-amber-50 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            ¿Listo para tu mudanza en Huancayo?
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
