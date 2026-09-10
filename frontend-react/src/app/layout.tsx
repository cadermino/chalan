import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import { ReferralCapture } from "@/components/ReferralCapture";
import { ChatWidget } from "@/components/ChatWidget";
import { PageViewTracker } from "@/components/PageViewTracker";
import { ScrollDepth } from "@/components/ScrollDepth";
import { GA_ENABLED, GA_DEBUG, GA_MEASUREMENT_ID } from "@/lib/analytics";
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
    "facebook-domain-verification": "l8bmdupxgdpy8tztk5y72hwte124mj",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={outfit.variable}>
      <body>
        <Suspense fallback={null}>
          <ReferralCapture />
        </Suspense>
        <PageViewTracker />
        <ScrollDepth />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-indigo-950 focus:text-white"
        >
          Saltar al contenido
        </a>
        {children}
        <ChatWidget />
        {process.env.NODE_ENV === "production" && (
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
        )}
        {GA_ENABLED && (
          <>
            {/* El shim y el config van beforeInteractive a propósito. Con
                send_page_view en false el page_view inicial lo manda
                PageViewTracker desde un efecto, que corre durante la
                hidratación — antes de que cargue gtag.js. Definiendo
                window.gtag temprano, ese evento se encola en dataLayer en vez
                de perderse, y queda después del config, que es el orden que
                GA necesita. */}
            <Script
              id="ga4"
              strategy="beforeInteractive"
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false${GA_DEBUG ? ", debug_mode: true" : ""} });`,
              }}
            />
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
          </>
        )}
      </body>
    </html>
  );
}
