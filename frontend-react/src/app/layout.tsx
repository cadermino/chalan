import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://chalan.pe"),
  title: "Chalán - Mudanzas y fletes confiables en Perú",
  description:
    "En Chalán te ayudamos a encontrar el vehículo ideal para tu mudanza o flete. Compara precios, elige tu movilidad y múdate fácil.",
  keywords: "mudanzas, fletes, Perú, Lima, transporte, mudanza barata, chalán",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Chalán - Mudanzas y fletes confiables en Perú",
    description:
      "En Chalán te ayudamos a encontrar el vehículo ideal para tu mudanza o flete. Compara precios y múdate fácil.",
    type: "website",
    locale: "es_PE",
    url: "https://chalan.pe",
    siteName: "Chalán",
    images: [
      {
        url: "https://chalan-public.s3.amazonaws.com/home/truck-list-fb.png",
        width: 1519,
        height: 1506,
        alt: "Chalán - Mudanzas y fletes en Perú",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chalán - Mudanzas y fletes confiables en Perú",
    description:
      "En Chalán te ayudamos a encontrar el vehículo ideal para tu mudanza o flete. Compara precios y múdate fácil.",
    images: ["https://chalan-public.s3.amazonaws.com/home/truck-list-fb.png"],
  },
  other: {
    "theme-color": "#1e1b4b",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.svg",
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
