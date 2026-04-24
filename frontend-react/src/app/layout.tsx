import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import { ReferralCapture } from "@/components/ReferralCapture";
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
    "google-site-verification": "TVw_Fd8m93dBC1mRQUrURalADcYzFOeY_L4z9bKaCrI",
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
        <Suspense fallback={null}>
          <ReferralCapture />
        </Suspense>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-indigo-950 focus:text-white"
        >
          Saltar al contenido
        </a>
        {children}
        <Script
          id="inspectlet"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function() {
  window.__insp = window.__insp || [];
  __insp.push(['wid', 1681414770]);
  var ldinsp = function(){
    if(typeof window.__inspld != "undefined") return; window.__inspld = 1; var insp = document.createElement('script'); insp.type = 'text/javascript'; insp.async = true; insp.id = "inspsync"; insp.src = ('https:' == document.location.protocol ? 'https' : 'http') + '://cdn.inspectlet.com/inspectlet.js?wid=1681414770&r=' + Math.floor(new Date().getTime()/3600000); var x = document.getElementsByTagName('script')[0]; x.parentNode.insertBefore(insp, x); };
  setTimeout(ldinsp, 0);
})();`,
          }}
        />
      </body>
    </html>
  );
}
