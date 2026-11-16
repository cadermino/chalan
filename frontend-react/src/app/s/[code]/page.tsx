import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getApiBase } from "@/lib/api";

// Link corto para cotizar una solicitud de servicio
// (chalan.pe/s/<solicitud>-<empresa>-<firma>), el que va en el WhatsApp a las
// empresas, como /c/ en las órdenes. El API revisa la firma y da el JWT del
// link de siempre: se redirige a la página de cotizar del backoffice. Ver
// app/api/quotation_short_link.py.

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ServiceQuotationShortLink({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let token: string | null = null;
  try {
    const res = await fetch(`${getApiBase()}/api/v1/service-quotation-links/${encodeURIComponent(code)}`, { cache: "no-store" });
    if (res.ok) token = (await res.json()).token ?? null;
  } catch {
    token = null;
  }
  // redirect() lanza: va fuera del try.
  if (!token) notFound();
  redirect(`/backoffice/carrier-view/${token}`);
}
