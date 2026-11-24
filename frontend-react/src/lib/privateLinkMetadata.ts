import type { Metadata } from "next";

// Vista previa de un link personal que se manda por WhatsApp (reseña, subir
// documentos…): su propio título y descripción, no los de la portada. Sin
// openGraph propio, la página hereda el del layout ("Mudanzas y fletes
// confiables en Perú"), que no dice para qué es el link. Nunca se indexa. Los
// links de Vue y del backoffice tienen lo mismo en su build (vite.config).
export const SHARE_IMAGE = "https://chalan-public.s3.amazonaws.com/home/truck-list-fb.png";

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
      images: [{ url: SHARE_IMAGE, width: 1519, height: 1506, alt: "Chalán" }],
    },
    twitter: { card: "summary", title, description },
  };
}
