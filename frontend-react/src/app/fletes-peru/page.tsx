import Link from "next/link";
import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/Breadcrumbs";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Fletes en Perú - Transporte de carga y mudanzas | Chalán",
  description:
    "Servicio de fletes en Perú. Transporte de carga, mudanzas y envíos a nivel nacional. Cotiza gratis, compara vehículos y elige el mejor precio.",
  keywords:
    "fletes peru, servicio flete lima, fletes a nivel nacional, transporte carga peru, flete mudanza, flete barato peru, camión de carga",
  alternates: {
    canonical: "/fletes-peru",
  },
  openGraph: {
    title: "Fletes en Perú - Chalán",
    description:
      "Transporte de carga y fletes a nivel nacional. Cotiza gratis y compara precios.",
    url: "https://chalan.pe/fletes-peru",
  },
};

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "MovingCompany",
  name: "Chalán - Fletes en Perú",
  url: "https://chalan.pe/fletes-peru",
  telephone: "+51-972-643-007",
  email: "carlos.calderon@chalan.pe",
  areaServed: {
    "@type": "Country",
    name: "Perú",
  },
  serviceType: ["Fletes", "Transporte de carga", "Mudanzas nacionales"],
  priceRange: "$$",
};

const vehicles = [
  { name: "Furgoneta", capacity: "Hasta 800 kg", ideal: "Mudanzas pequeñas, envíos de cajas y electrodomésticos." },
  { name: "Camioneta Pick-up", capacity: "Hasta 1 tonelada", ideal: "Muebles medianos, materiales de construcción." },
  { name: "Camión pequeño", capacity: "Hasta 3 toneladas", ideal: "Mudanzas de departamentos, carga mediana." },
  { name: "Camión grande", capacity: "Hasta 10 toneladas", ideal: "Mudanzas completas de casa, carga pesada." },
];

const routes = [
  "Lima → Arequipa",
  "Lima → Trujillo",
  "Lima → Cusco",
  "Lima → Huancayo",
  "Lima → Chiclayo",
  "Lima → Piura",
  "Lima → Ica",
  "Lima → Huaraz",
];

export default function FletesPeru() {
  return (
    <main id="main-content" className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <Navbar />

      <div className="container mx-auto px-6 py-16 max-w-4xl">
        <BreadcrumbJsonLd
          items={[
            { name: "Inicio", url: "https://chalan.pe" },
            { name: "Fletes en Perú", url: "https://chalan.pe/fletes-peru" },
          ]}
        />

        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Fletes en Perú
        </h1>
        <p className="text-lg text-gray-600 mb-10">
          Servicio de fletes y transporte de carga a nivel nacional. Compara
          vehículos, elige el mejor precio y programa tu envío.
        </p>

        {/* CTA */}
        <div className="bg-indigo-950 text-white rounded-2xl p-8 mb-12">
          <h2 className="text-2xl font-bold mb-3">
            Cotiza tu flete gratis
          </h2>
          <p className="text-white/70 mb-6">
            Ingresa origen, destino y fecha. Te mostramos vehículos disponibles
            con precios al instante.
          </p>
          <Link
            href="/order/step-one"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-amber-400 text-indigo-950 font-semibold hover:bg-amber-300 transition-colors"
          >
            Cotizar flete
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Tipos de vehículos */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Tipos de vehículos disponibles
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {vehicles.map((v) => (
              <div key={v.name} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-1">{v.name}</h3>
                <p className="text-indigo-600 text-sm font-medium mb-2">{v.capacity}</p>
                <p className="text-gray-600 text-sm">{v.ideal}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            ¿Cómo contratar un flete con Chalán?
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              { step: "1", title: "Ingresa tus direcciones", desc: "Indica el origen y destino de tu carga." },
              { step: "2", title: "Elige fecha y hora", desc: "Selecciona cuándo necesitas el flete." },
              { step: "3", title: "Compara vehículos", desc: "Te mostramos opciones con precio según tu ruta y capacidad." },
              { step: "4", title: "Confirma y listo", desc: "Reserva, paga en efectivo o con tarjeta, y recibe tu carga." },
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
            ¿Por qué elegir Chalán para tu flete?
          </h2>
          <div className="space-y-4 text-gray-700 leading-relaxed">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-2">Cobertura nacional</h3>
              <p>Realizamos fletes entre las principales ciudades del Perú por rutas seguras y conocidas.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-2">Precios transparentes</h3>
              <p>Compara el costo de diferentes vehículos antes de contratar. Sin cobros ocultos ni sorpresas.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-2">Chalanes con experiencia</h3>
              <p>Cada transportista conoce las rutas y maneja con cuidado tu carga. Incluyen ayudantes.</p>
            </div>
          </div>
        </section>

        {/* Rutas populares */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Rutas de flete populares
          </h2>
          <div className="flex flex-wrap gap-2">
            {routes.map((r) => (
              <span
                key={r}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium"
              >
                {r}
              </span>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Preguntas frecuentes sobre fletes en Perú
          </h2>
          <div className="space-y-4">
            {[
              { q: "¿Cuánto cuesta un flete en Perú?", a: "El precio depende de la distancia, tipo de vehículo y volumen de carga. Con Chalán puedes cotizar gratis al instante." },
              { q: "¿Qué puedo enviar por flete?", a: "Muebles, electrodomésticos, cajas, materiales de construcción, equipos y más. Solo no transportamos materiales peligrosos." },
              { q: "¿Los fletes incluyen ayudantes?", a: "Sí, nuestros servicios incluyen ayudantes para cargar y descargar tu mercadería." },
              { q: "¿Cuánto tarda un flete de Lima a provincia?", a: "Depende de la ciudad destino. Por ejemplo, Lima a Huancayo toma aproximadamente 7 horas, Lima a Arequipa alrededor de 15 horas." },
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
            ¿Necesitas un flete?
          </h2>
          <p className="text-gray-600 mb-4">
            Cotiza gratis y compara precios de vehículos en segundos.
          </p>
          <Link
            href="/order/step-one"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-indigo-950 text-white font-semibold hover:bg-indigo-900 transition-colors"
          >
            Cotizar ahora
          </Link>
        </div>
      </div>
      <Footer />
    </main>
  );
}
