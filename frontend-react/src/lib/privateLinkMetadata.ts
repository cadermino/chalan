import type { Metadata } from "next";

// Vista previa de un link personal que se manda por WhatsApp (reseña, subir
// documentos…): su propio título y descripción, no los de la portada. Sin
// openGraph propio, la página hereda el del layout ("Mudanzas y fletes
// confiables en Perú"), que no dice para qué es el link. Nunca se indexa. Los
// links de Vue y del backoffice tienen lo mismo en su build (vite.config).
//
// La imagen es el chalán (public/og/chalan.png): estos links no son solo de
// mudanzas (reseñas de servicios, documentos de profesionales, pedidos de
// pintura…). El camión queda para los de mudanzas (el layout y los de Vue).
export const CHALAN_IMAGE = "https://chalan.pe/og/chalan.png";

// Para el openGraph de las páginas públicas que no son de mudanzas (servicios,
// profesionales). Una página con openGraph propio no hereda la imagen del layout:
// sin esto WhatsApp no mostraba ninguna.
export const CHALAN_OG_IMAGES = [{ url: CHALAN_IMAGE, width: 1200, height: 1200, alt: "Chalán" }];

// El camión del layout, para las páginas de mudanzas y generales con openGraph
// propio: tampoco heredan la imagen del layout.
export const TRUCK_OG_IMAGES = [{
  url: "https://chalan-public.s3.amazonaws.com/home/truck-list-fb.png", width: 1519, height: 1506,
  alt: "Chalán - Mudanzas y fletes en Perú",
}];

export function privateLinkMetadata(title: string, description: string): Metadata {
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      siteName: "Chalán",
      locale: "es_PE",
      type: "website",
      images: CHALAN_OG_IMAGES,
    },
    twitter: { card: "summary", title, description },
  };
}
