import Link from "next/link";
import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/Breadcrumbs";
import { LandingFooter } from "@/components/LandingFooter";
import { LandingNav } from "@/components/LandingNav";
import { CarrierSignupForm } from "@/components/CarrierSignupForm";

export const metadata: Metadata = {
  title: "Trabaja con Chalán - Registra tu empresa de mudanzas | Chalán",
  description:
    "Únete a la red de transportistas de Chalán en Perú. Recibe pedidos de mudanza sin gastar en marketing, elige qué mudanzas tomar y gestiona todo desde tu panel. Registro gratis.",
  keywords:
    "trabajar como transportista chalan, empresa de mudanzas afiliarse, transportistas peru, chalanes chalan, unirse chalan mudanzas",
  alternates: {
    canonical: "/transportistas",
  },
  openGraph: {
    title: "Trabaja con Chalán - Registra tu empresa de mudanzas",
    description:
      "Recibe pedidos de mudanza sin gastar en marketing. Regístrate gratis y empieza a cotizar.",
    url: "https://chalan.pe/transportistas",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Chalán",
  url: "https://chalan.pe",
  logo: "https://chalan-public.s3.amazonaws.com/home/truck-list-fb.png",
  sameAs: ["https://wa.me/51972643007"],
};

const faqs = [
  {
    q: "¿Cuánto cuesta registrarse?",
    a: "Nada. Crear tu cuenta y el perfil de tu empresa es gratis, sin cuota de afiliación.",
  },
  {
    q: "¿Estoy obligado a aceptar todas las mudanzas?",
    a: "No. Tú decides a qué pedidos cotizar según la ruta, el tamaño y la fecha que te convengan.",
  },
  {
    q: "¿Cuánto tiempo tarda la aprobación de mi cuenta?",
    a: "Un administrador revisa y activa las cuentas nuevas normalmente en poco tiempo. Te avisaremos cuando puedas empezar a cotizar.",
  },
  {
    q: "¿Qué necesito para completar mi perfil?",
    a: "Después de la aprobación, completas desde tu panel los datos de tu empresa y de tus vehículos (marca, capacidad, tarifas).",
  },
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

const benefits = [
  {
    title: "Más pedidos, sin gastar en marketing",
    desc: "Recibes solicitudes de clientes que ya están buscando mudanza en Chalán. Tú no pagas por publicidad propia.",
  },
  {
    title: "Tú decides qué mudanzas tomar",
    desc: "Cotizas solo los pedidos que te convienen — no hay obligación de aceptar todo lo que llega.",
  },
  {
    title: "Sin costo de entrada",
    desc: "Registrarte y crear el perfil de tu empresa es gratis. No hay cuota de afiliación.",
  },
  {
    title: "Panel propio para gestionar todo",
    desc: "Administra vehículos, cotizaciones y pedidos desde un solo lugar, sin planillas ni WhatsApp perdido.",
  },
];

export default function Transportistas() {
  return (
    <main id="main-content" className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
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
            { name: "Transportistas", url: "https://chalan.pe/transportistas" },
          ]}
        />

        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Trabaja con Chalán
        </h1>
        <p className="text-lg text-gray-600 mb-10">
          Únete a la red de transportistas de Chalán y recibe pedidos de mudanza
          de clientes que ya están buscando en la plataforma. Regístrate gratis
          en minutos.
        </p>

        {/* Beneficios */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            ¿Por qué trabajar con Chalán?
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {benefits.map((b) => (
              <div key={b.title} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-1">{b.title}</h3>
                <p className="text-gray-600 text-sm">{b.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            ¿Cómo funciona?
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              { step: "1", title: "Regístrate", desc: "Completa el formulario con tus datos. Toma menos de dos minutos." },
              { step: "2", title: "Completa tu perfil", desc: "Una vez aprobada tu cuenta, agrega los datos de tu empresa y tus vehículos." },
              { step: "3", title: "Cotiza pedidos", desc: "Verás las mudanzas disponibles y podrás cotizar las que te convengan." },
              { step: "4", title: "Cobra por tu trabajo", desc: "Realizas la mudanza y recibes el pago del pedido cotizado." },
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
          <div className="mt-6 bg-amber-50 rounded-xl p-5 border border-amber-100">
            <p className="text-sm text-gray-700">
              <strong>Tip:</strong> los transportistas que cotizan en menos de 5 minutos
              después de recibir un pedido tienen más chances de ganarlo. Los clientes
              suelen elegir entre las primeras respuestas.
            </p>
          </div>
        </section>

        {/* Formulario de registro */}
        <section className="mb-12" id="registro">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Registra tu empresa
          </h2>
          <CarrierSignupForm />
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Preguntas frecuentes
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

        {/* Bottom CTA */}
        <div className="bg-amber-50 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            ¿Listo para recibir pedidos?
          </h2>
          <p className="text-gray-600 mb-4">
            Regístrate gratis y empieza a cotizar mudanzas.
          </p>
          <Link
            href="#registro"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-indigo-950 text-white font-semibold hover:bg-indigo-900 transition-colors"
          >
            Registrar mi empresa
          </Link>
        </div>
      </div>
      <LandingFooter />
    </main>
  );
}
