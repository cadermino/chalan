import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-outfit",
});

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={outfit.variable}>
      <head>
        <link
          rel="preload"
          href="/images/hero-bg.webp"
          as="image"
          type="image/webp"
        />
      </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-indigo-950 focus:text-white"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
