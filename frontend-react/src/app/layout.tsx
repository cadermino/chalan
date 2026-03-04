import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chalán - Mudanzas y fletes confiables en Perú",
  description:
    "En Chalán te ayudamos a encontrar el vehículo ideal para tu mudanza o flete. Compara precios, elige tu movilidad y múdate fácil.",
  keywords: "mudanzas, fletes, Perú, Lima, transporte, mudanza barata, chalán",
  openGraph: {
    title: "Chalán - Mudanzas y fletes confiables en Perú",
    description:
      "En Chalán te ayudamos a encontrar el vehículo ideal para tu mudanza o flete",
    type: "website",
    locale: "es_PE",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
