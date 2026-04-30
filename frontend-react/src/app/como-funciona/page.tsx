import Link from "next/link";
import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/Breadcrumbs";
import { LandingFooter } from "@/components/LandingFooter";
import { LandingNav } from "@/components/LandingNav";

export const metadata: Metadata = {
  title: "¿Cómo funciona Chalán? - Cotiza tu mudanza paso a paso",
  description:
    "Conoce cómo funciona Chalán paso a paso: ingresa tus direcciones, compara vehículos, elige el mejor precio y programa tu mudanza o flete en minutos.",
  keywords:
    "como funciona chalan, cotizar mudanza online, pasos mudanza, reservar flete peru, mudanza facil",
  alternates: {
    canonical: "/como-funciona",
  },
  openGraph: {
    title: "¿Cómo funciona Chalán?",
    description:
      "Cotiza tu mudanza o flete en 4 simples pasos. Compara precios y reserva fácil.",
    url: "https://chalan.pe/como-funciona",
  },
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "Cómo cotizar y reservar una mudanza en Chalán",
  description:
    "Guía paso a paso para cotizar y reservar tu mudanza o flete con Chalán en Perú.",
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Ingresa tus direcciones",
      text: "Abre chalan.pe, haz clic en 'Cotizar mudanza' e ingresa la dirección de origen y destino de tu mudanza o flete.",
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Selecciona fecha y hora",
      text: "Elige la fecha y hora en la que necesitas el servicio. Puedes programar con anticipación o para el mismo día.",
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "Compara vehículos y precios",
      text: "Te mostramos los vehículos disponibles con sus precios según la ruta y el tamaño del vehículo. Elige el que más te convenga.",
    },
    {
      "@type": "HowToStep",
      position: 4,
      name: "Confirma tu reserva",
      text: "Confirma tu reserva y elige cómo pagar: en efectivo al transportista o con tarjeta. Tu chalán llegará puntual.",
    },
  ],
};

const steps = [
  {
    number: "1",
    title: "Ingresa tus direcciones",
    description:
      "Abre chalan.pe y haz clic en «Cotizar mudanza». Ingresa la dirección de origen y destino. Nuestro sistema calcula la distancia automáticamente.",
    detail:
      "Puedes ingresar cualquier dirección en Perú. El sistema usa Google Maps para calcular la ruta óptima y la distancia exacta.",
  },
  {
    number: "2",
    title: "Selecciona fecha y hora",
    description:
      "Elige cuándo necesitas el servicio. Puedes programar con anticipación o solicitar para el mismo día si hay disponibilidad.",
    detail:
      "Te recomendamos reservar con al menos 2 días de anticipación para asegurar disponibilidad de vehículos.",
  },
  {
    number: "3",
    title: "Compara vehículos y precios",
    description:
      "Te mostramos los vehículos disponibles con precios calculados según tu ruta. Desde furgonetas hasta camiones grandes.",
    detail:
      "Cada vehículo muestra su capacidad de carga, precio y tiempo estimado de llegada. Elige el que mejor se adapte a tus necesidades.",
  },
  {
    number: "4",
    title: "Confirma tu reserva",
    description:
      "Elige método de pago (efectivo o tarjeta) y confirma. Tu chalán se pondrá en contacto contigo y llegará puntual.",
    detail:
      "Recibirás un correo de confirmación con los datos del servicio. Puedes contactar directamente al transportista si necesitas coordinar detalles.",
  },
];

export default function ComoFunciona() {
  return (
    <main id="main-content" className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      <LandingNav />

      <div className="container mx-auto px-6 py-16 max-w-4xl">
        <BreadcrumbJsonLd
          items={[
            { name: "Inicio", url: "https://chalan.pe" },
            { name: "¿Cómo funciona?", url: "https://chalan.pe/como-funciona" },
          ]}
        />

        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          ¿Cómo funciona Chalán?
        </h1>
        <p className="text-lg text-gray-600 mb-10">
          Cotiza tu mudanza o flete en 4 simples pasos. Sin compromisos, sin
          cobros ocultos y en minutos.
        </p>

        {/* Steps */}
        <section className="mb-12">
          <div className="space-y-8">
            {steps.map((step) => (
              <div key={step.number} className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
                <div className="flex items-start gap-5">
                  <div className="w-12 h-12 rounded-full bg-indigo-950 text-white font-bold text-lg flex items-center justify-center flex-shrink-0">
                    {step.number}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                      {step.title}
                    </h2>
                    <p className="text-gray-700 mb-3">{step.description}</p>
                    <p className="text-gray-500 text-sm">{step.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA intermedio */}
        <div className="bg-indigo-950 text-white rounded-2xl p-8 mb-12">
          <h2 className="text-2xl font-bold mb-3">
            ¿Listo para probar?
          </h2>
          <p className="text-white/70 mb-6">
            Es gratis cotizar. Ingresa tus direcciones y compara precios en
            segundos.
          </p>
          <Link
            href="/order/step-one"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-amber-400 text-indigo-950 font-semibold hover:bg-amber-300 transition-colors"
          >
            Cotizar mudanza
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Beneficios */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            ¿Qué hace diferente a Chalán?
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { title: "Precios transparentes", desc: "Compara antes de decidir. No hay letra chica ni cobros extras." },
              { title: "Rápido y fácil", desc: "Cotiza en menos de 2 minutos desde tu celular o computadora." },
              { title: "Confianza", desc: "Lee reseñas de otros clientes antes de elegir a tu transportista." },
            ].map((b) => (
              <div key={b.title} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
                <h3 className="font-semibold text-gray-900 mb-2">{b.title}</h3>
                <p className="text-gray-600 text-sm">{b.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Preguntas frecuentes
          </h2>
          <div className="space-y-4">
            {[
              { q: "¿Cotizar tiene algún costo?", a: "No, cotizar es completamente gratis y sin compromiso." },
              { q: "¿Puedo cancelar mi reserva?", a: "Sí, puedes cancelar antes de la fecha programada sin penalidad." },
              { q: "¿Cómo pago el servicio?", a: "Puedes pagar en efectivo directamente al transportista o con tarjeta de crédito/débito a través de la plataforma." },
              { q: "¿Los transportistas incluyen ayudantes?", a: "Sí, nuestros chalanes incluyen ayudantes para cargar y descargar tus pertenencias." },
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

        {/* Enlaces internos */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Explora nuestros servicios
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <Link href="/mudanzas-lima" className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:border-indigo-200 transition-colors group">
              <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">Mudanzas en Lima</h3>
              <p className="text-gray-500 text-sm mt-1">Servicio en los 43 distritos</p>
            </Link>
            <Link href="/mudanzas-huancayo" className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:border-indigo-200 transition-colors group">
              <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">Mudanzas en Huancayo</h3>
              <p className="text-gray-500 text-sm mt-1">Servicio en el Valle del Mantaro</p>
            </Link>
            <Link href="/fletes-peru" className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:border-indigo-200 transition-colors group">
              <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">Fletes en Perú</h3>
              <p className="text-gray-500 text-sm mt-1">Transporte de carga nacional</p>
            </Link>
          </div>
        </section>

        {/* Bottom CTA */}
        <div className="bg-amber-50 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            ¡Es hora de mudarte fácil!
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
      <LandingFooter />
    </main>
  );
}
