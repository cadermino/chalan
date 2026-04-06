import Link from "next/link";
import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/Breadcrumbs";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Contacto - Chalán | Mudanzas y fletes en Perú",
  description:
    "Comunícate con Chalán por WhatsApp al 972 643 007 o correo. Resolvemos dudas sobre mudanzas, fletes y cómo ser socio transportista.",
  keywords:
    "contacto chalán, teléfono mudanzas lima, whatsapp chalán, ser socio transportista",
  alternates: {
    canonical: "/contacto",
  },
  openGraph: {
    title: "Contacto - Chalán",
    description:
      "Comunícate con Chalán por WhatsApp o correo. Dudas sobre mudanzas, fletes o ser socio transportista.",
    url: "https://chalan.pe/contacto",
  },
};

const contactJsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Chalán",
  url: "https://chalan.pe",
  telephone: "+51-972-643-007",
  email: "carlos.calderon@chalan.pe",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Lima",
    addressCountry: "PE",
  },
  openingHours: "Mo-Su 08:00-20:00",
  areaServed: {
    "@type": "City",
    name: "Lima",
  },
  priceRange: "$$",
};

export default function Contacto() {
  return (
    <main id="main-content" className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }}
      />
      <Navbar />

      <div className="container mx-auto px-6 py-16 max-w-3xl">
        <BreadcrumbJsonLd
          items={[
            { name: "Inicio", url: "https://chalan.pe" },
            { name: "Contacto", url: "https://chalan.pe/contacto" },
          ]}
        />
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Contacto</h1>

        <div className="space-y-6 text-gray-700 leading-relaxed">
          <p>
            Si tienes alguna duda o sugerencia, comunícate con nosotros al{" "}
            <a href="tel:972643007" className="text-indigo-700 font-semibold hover:underline">
              972 643 007
            </a>{" "}
            o al correo{" "}
            <a
              href="mailto:carlos.calderon@chalan.pe"
              className="text-indigo-700 font-semibold hover:underline"
            >
              carlos.calderon@chalan.pe
            </a>
            .
          </p>

          <p>
            Si tienes vehículos de mudanza y quieres trabajar con nosotros como
            socio Chalán comunícate al{" "}
            <a href="tel:972643007" className="text-indigo-700 font-semibold hover:underline">
              972 643 007
            </a>{" "}
            en horarios de 8:00 a 20:00 horas.
          </p>
        </div>
      </div>
      <Footer />
    </main>
  );
}
