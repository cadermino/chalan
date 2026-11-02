import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getApiBase } from "@/lib/api";

// Link corto para cotizar una orden (chalan.pe/c/<orden>-<empresa>-<firma>),
// el que va en el recordatorio por WhatsApp a los transportistas. El API
// revisa la firma y da el JWT del link de siempre: se redirige a la página de
// cotizar de Vue. Ver app/api/quotation_short_link.py.

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function QuotationShortLink({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let token: string | null = null;
  try {
    const res = await fetch(`${getApiBase()}/api/v1/quotation-links/${encodeURIComponent(code)}`, { cache: "no-store" });
    if (res.ok) token = (await res.json()).token ?? null;
  } catch {
    token = null;
  }
  // redirect() lanza: va fuera del try.
  if (!token) notFound();
  redirect(`/quotation/${token}`);
}
