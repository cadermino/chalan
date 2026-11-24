import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getApiBase } from "@/lib/api";

// Link corto de reseña (chalan.pe/r/o<orden>-<firma> para una mudanza,
// chalan.pe/r/s<solicitud>-<firma> para un servicio), el que se le manda al
// cliente por WhatsApp. El API revisa la firma y que se pueda reseñar, y da el
// JWT del link de siempre: se redirige a /reviews/submit. Ver
// app/api/review_short_link.py.

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ReviewShortLink({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let token: string | null = null;
  try {
    const res = await fetch(`${getApiBase()}/api/v1/review-links/${encodeURIComponent(code)}`, { cache: "no-store" });
    if (res.ok) token = (await res.json()).token ?? null;
  } catch {
    token = null;
  }
  // redirect() lanza: va fuera del try.
  if (!token) notFound();
  redirect(`/reviews/submit/${token}`);
}
