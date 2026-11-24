import { TokenReviewForm } from "@/components/TokenReviewForm";
import type { Metadata } from "next";
import { privateLinkMetadata } from "@/lib/privateLinkMetadata";

// Lo abre el link corto /r/ que se le manda al cliente por WhatsApp.
export const metadata: Metadata = privateLinkMetadata(
  "¿Cómo te fue? Deja tu reseña | Chalán",
  "Califica a la empresa que hizo tu mudanza, flete o servicio. Te toma un minuto y ayuda a otros clientes a elegir.",
);

export default async function SubmitReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main id="main-content" className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-6 py-12 max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Deja tu reseña</h1>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <TokenReviewForm token={token} />
        </div>
      </div>
    </main>
  );
}
