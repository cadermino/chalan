import Link from "next/link";
import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/Breadcrumbs";
import { LandingFooter } from "@/components/LandingFooter";
import { LandingNav } from "@/components/LandingNav";

export const metadata: Metadata = {
  title: "Preguntas frecuentes sobre mudanzas y fletes - Chalán",
  description:
    "Resolvemos tus dudas sobre mudanzas en Lima y Perú: precios, formas de pago, cobertura, seguro de carga y cómo funciona Chalán.",
  keywords:
    "preguntas frecuentes mudanzas, cuánto cuesta mudanza lima, flete seguro perú, mudanza barata",
  alternates: {
    canonical: "/preguntas-frecuentes",
  },
  openGraph: {
    title: "Preguntas frecuentes - Chalán",
    description:
      "Resolvemos tus dudas sobre mudanzas en Lima y Perú: precios, formas de pago, cobertura y más.",
    url: "https://chalan.pe/preguntas-frecuentes",
  },
};

const faqs = [
  {
    question: "¿Cómo funciona Chalán?",
    answer:
      "Ingresa las direcciones de origen y destino, elige la fecha y hora de tu mudanza, y te mostramos una lista de vehículos disponibles con precios. Escoge el que más te convenga y listo.",
  },
  {
    question: "¿Cuánto cuesta una mudanza con Chalán?",
    answer:
      "El precio depende de la distancia, el tamaño del vehículo y la cantidad de cosas a transportar. En Chalán puedes comparar precios de diferentes vehículos para elegir la opción que se ajuste a tu presupuesto.",
  },
  {
    question: "¿Qué formas de pago aceptan?",
    answer:
      "Aceptamos pagos en efectivo y con tarjeta de crédito o débito. Puedes elegir la opción que prefieras al momento de confirmar tu mudanza.",
  },
  {
    question: "¿Chalán tiene cobertura en todo el Perú?",
    answer:
      "Actualmente operamos principalmente en Lima Metropolitana. Para mudanzas foráneas o fuera de nuestra zona de cobertura, un chalán buscará personalmente hasta tres opciones y te las enviará para que elijas.",
  },
  {
    question: "¿Los mudanceros están verificados?",
    answer:
      "Sí. Todas las empresas transportistas que trabajan con Chalán pasan por un proceso de verificación. Además, puedes consultar las reseñas y calificaciones de otros clientes antes de elegir.",
  },
  {
    question: "¿Qué pasa si mis cosas no caben en el vehículo?",
    answer:
      "Te recomendamos describir con detalle las cosas que vas a mudar para que podamos sugerirte el vehículo adecuado. Si necesitas más espacio, puedes cotizar un vehículo más grande o coordinar un segundo viaje.",
  },
  {
    question: "¿Con cuánta anticipación debo reservar?",
    answer:
      "Te recomendamos reservar con al menos 48 horas de anticipación para asegurar disponibilidad, aunque también atendemos solicitudes de último momento según la disponibilidad de nuestros socios.",
  },
  {
    question: "¿Puedo cancelar o reprogramar mi mudanza?",
    answer:
      "Sí, puedes comunicarte con nosotros al 972 643 007 para cancelar o reprogramar. Te recomendamos hacerlo con al menos 24 horas de anticipación.",
  },
  {
    question: "¿Ofrecen servicio de embalaje o ayudantes de carga?",
    answer:
      "Algunos de nuestros socios transportistas incluyen ayudantes de carga. Al momento de cotizar, podrás ver los detalles de cada servicio. Para embalaje especializado, contáctanos directamente.",
  },
  {
    question: "¿Cómo puedo contactar a Chalán?",
    answer:
      "Puedes escribirnos por WhatsApp al 972 643 007 o enviarnos un correo a carlos.calderon@chalan.pe. Nuestro horario de atención es de 8:00 a 20:00 horas.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export default function PreguntasFrecuentes() {
  return (
    <main id="main-content" className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <LandingNav />

      <div className="container mx-auto px-6 py-16 max-w-3xl">
        <BreadcrumbJsonLd
          items={[
            { name: "Inicio", url: "https://chalan.pe" },
            { name: "Preguntas frecuentes", url: "https://chalan.pe/preguntas-frecuentes" },
          ]}
        />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Preguntas frecuentes
        </h1>
        <p className="text-gray-500 mb-10">
          Resolvemos tus dudas sobre mudanzas y fletes con Chalán
        </p>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <details
              key={index}
              className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <summary className="flex items-center justify-between cursor-pointer px-6 py-5 font-semibold text-gray-900 hover:bg-gray-50 transition-colors">
                {faq.question}
                <svg
                  className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0 ml-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-5 text-gray-600 leading-relaxed">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>

        <div className="mt-12 bg-indigo-50 rounded-xl p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            ¿Tienes otra pregunta?
          </h2>
          <p className="text-gray-600 mb-4">
            Escríbenos y te responderemos lo antes posible.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://wa.me/51972643007"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors"
            >
              WhatsApp
            </a>
            <a
              href="mailto:carlos.calderon@chalan.pe"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-indigo-700 text-white font-semibold hover:bg-indigo-800 transition-colors"
            >
              Correo electrónico
            </a>
          </div>
        </div>
      </div>
      <LandingFooter />
    </main>
  );
}
