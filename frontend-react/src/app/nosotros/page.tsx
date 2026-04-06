import Link from "next/link";
import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/Breadcrumbs";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Nosotros - Chalán | Plataforma de mudanzas en Perú",
  description:
    "Conoce Chalán, la plataforma digital que facilita tus mudanzas en Lima y Perú. Comparamos precios de vehículos para que elijas la mejor opción.",
  keywords:
    "chalán empresa, mudanzas lima, plataforma mudanzas perú, quiénes somos chalán",
  alternates: {
    canonical: "/nosotros",
  },
  openGraph: {
    title: "Nosotros - Chalán",
    description:
      "Conoce Chalán, la plataforma digital que facilita tus mudanzas en Lima y Perú.",
    url: "https://chalan.pe/nosotros",
  },
};

const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Chalán",
  url: "https://chalan.pe",
  logo: "https://chalan-public.s3.amazonaws.com/home/truck-list-fb.png",
  description:
    "Plataforma digital que facilita el requerimiento de movilidad para mudanzas locales y foráneas en Perú.",
  areaServed: {
    "@type": "Country",
    name: "Perú",
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+51-972-643-007",
    contactType: "customer service",
    availableLanguage: "Spanish",
  },
};

export default function Nosotros() {
  return (
    <main id="main-content" className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", url: "https://chalan.pe" },
          { name: "Nosotros", url: "https://chalan.pe/nosotros" },
        ]}
      />
      <Navbar />

      <div className="container mx-auto px-6 py-16 max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Nosotros</h1>

        <div className="space-y-6 text-gray-700 leading-relaxed">
          <p>
            <strong>Chalán</strong> es una plataforma digital que facilita
            (automatiza) el requerimiento de movilidad para mudanzas locales y
            foráneas brindando una lista de vehículos donde mostramos precio y
            tamaño, además de una descripción del vehículo.
          </p>

          <p>
            Si no contamos con cobertura para la zona y horario que el usuario
            indica, un chalán buscará personalmente hasta tres opciones y lo
            enviará al cliente para que pueda elegir el que más le convenga.
          </p>

          <p>Lo que requerimos del cliente es:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Las direcciones de donde y hacia donde se quiere mudar</li>
            <li>Los pisos de las viviendas</li>
            <li>La fecha de la mudanza</li>
          </ul>
        </div>
      </div>
      <Footer />
    </main>
  );
}
