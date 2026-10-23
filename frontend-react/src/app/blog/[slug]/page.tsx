import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { getPost, getAllSlugs } from "@/lib/blog";
import { LandingNav } from "@/components/LandingNav";
import { LandingFooter } from "@/components/LandingFooter";
import { BreadcrumbJsonLd } from "@/components/Breadcrumbs";
import { QuoteWidget } from "@/components/QuoteWidget";
import { WaitlistForm } from "@/components/WaitlistForm";
import { CarrierSignupForm } from "@/components/CarrierSignupForm";
import { HOME_SERVICES, whatsappUrl } from "@/lib/homeServices";

interface Props {
  params: Promise<{ slug: string }>;
}

const SITE_URL = "https://chalan.pe";
const DEFAULT_OG_IMAGE = "https://chalan-public.s3.amazonaws.com/home/truck-list-fb.png";

function absoluteUrl(path: string): string {
  return path.startsWith("http") ? path : `${SITE_URL}${path}`;
}

// Google requires ISO 8601 with a timezone. Frontmatter dates are date-only
// (e.g. "2026-04-09"); anchor them to Peru time (UTC-5, no DST).
function toIsoDate(date: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00-05:00` : date;
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};

  return {
    title: `${post.title} | Chalán`,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${SITE_URL}/blog/${slug}`,
      type: "article",
      publishedTime: toIsoDate(post.date),
      ...(post.updated ? { modifiedTime: toIsoDate(post.updated) } : {}),
      images: [post.image ? absoluteUrl(post.image) : DEFAULT_OG_IMAGE],
    },
  };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-PE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const imageUrl = post.image ? absoluteUrl(post.image) : DEFAULT_OG_IMAGE;
  const publishedIso = toIsoDate(post.date);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    image: imageUrl,
    datePublished: publishedIso,
    dateModified: post.updated ? toIsoDate(post.updated) : publishedIso,
    author: { "@type": "Organization", name: "Chalán", url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: "Chalán",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: "https://chalan.pe/logo_chalan.png",
      },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/${slug}` },
  };

  return (
    <main id="main-content" className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <LandingNav />

      <div className="container mx-auto px-6 py-16 max-w-3xl">
        <BreadcrumbJsonLd
          items={[
            { name: "Inicio", url: "https://chalan.pe" },
            { name: "Blog", url: "https://chalan.pe/blog" },
            { name: post.title, url: `https://chalan.pe/blog/${slug}` },
          ]}
        />

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
              {post.category}
            </span>
            <span className="text-gray-400 text-sm">{post.readingTime} min lectura</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">
            {post.title}
          </h1>
          <p className="text-lg text-gray-500 mb-4">{post.description}</p>
          <p className="text-gray-400 text-sm">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            {post.updated && (
              <>
                {" · Actualizado el "}
                <time dateTime={post.updated}>{formatDate(post.updated)}</time>
              </>
            )}
          </p>
        </div>

        {/* MDX Content */}
        <article className="prose prose-gray prose-lg max-w-none
          prose-headings:font-bold prose-headings:text-gray-900
          prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
          prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
          prose-p:text-gray-600 prose-p:leading-relaxed
          prose-li:text-gray-600
          prose-strong:text-gray-800
          prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline
          prose-blockquote:border-indigo-300 prose-blockquote:text-gray-600
          prose-table:w-full prose-table:text-sm
          prose-thead:bg-indigo-50 prose-th:text-indigo-700 prose-th:font-semibold prose-th:px-4 prose-th:py-2
          prose-td:px-4 prose-td:py-2 prose-tr:border-b prose-tr:border-gray-100">
          <MDXRemote
            source={post.content}
            options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
            components={{ QuoteWidget }}
          />
        </article>

        {/* Waitlist — solo para posts con waitlist: true */}
        {post.waitlist && (
          <WaitlistForm source={slug} />
        )}

        {/* CTA post-article — registro para posts de transportistas, formulario
            de embalaje para los posts de embalaje, WhatsApp para los servicios a
            domicilio sin formulario, cotizador para el resto */}
        {post.category === "Transportistas" ? (
          <div className="mt-16">
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">¿Listo para recibir pedidos?</p>
            <CarrierSignupForm theme="light" />
          </div>
        ) : post.cta === "embalaje" ? (
          <div className="mt-16">
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">¿Prefieres que lo empaquen por ti?</p>
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900">Cotiza el embalaje en 2 minutos</h2>
              <p className="mt-2 text-gray-600">
                Un equipo va a tu casa con los materiales y lo empaca todo. Llenas el formulario y los
                transportistas que ofrecen embalaje te cotizan por WhatsApp.
              </p>
              <ol className="mt-5 grid gap-3 sm:grid-cols-3 text-sm text-gray-700">
                {["La dirección donde hay que embalar", "Qué cosas hay que empacar", "La fecha que prefieres"].map((step, i) => (
                  <li key={step} className="flex items-start gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              {/* <a> y no next/link: /embalaje/cotizar lo sirve otro contenedor
                  (services-web), y la navegación del cliente pediría un payload
                  RSC que no existe. Mismo criterio que LandingNav. */}
              <a
                href="/embalaje/cotizar"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700"
              >
                Cotizar embalaje →
              </a>
            </div>
          </div>
        ) : post.cta ? (
          <div className="mt-16">
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
              {HOME_SERVICES[post.cta].blogCta.eyebrow}
            </p>
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900">{HOME_SERVICES[post.cta].blogCta.title}</h2>
              <p className="mt-2 text-gray-600">{HOME_SERVICES[post.cta].blogCta.body}</p>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                {/* Con formulario (pintura), el botón va ahí; <a> porque lo sirve services-web. */}
                {HOME_SERVICES[post.cta].formUrl ? (
                  <>
                    <a
                      href={HOME_SERVICES[post.cta].formUrl}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700"
                    >
                      Cotizar en 2 minutos →
                    </a>
                    <a
                      href={whatsappUrl(HOME_SERVICES[post.cta].whatsappText)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 font-medium hover:underline"
                    >
                      o por WhatsApp
                    </a>
                  </>
                ) : (
                <a
                  href={whatsappUrl(HOME_SERVICES[post.cta].whatsappText)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700"
                >
                  Cotizar por WhatsApp →
                </a>
                )}
                <Link href={HOME_SERVICES[post.cta].path} className="text-indigo-600 font-medium hover:underline">
                  Ver precios de {HOME_SERVICES[post.cta].name.toLowerCase()}
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-16">
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
              {post.quoteLoad === "cargo" ? "¿Listo para mandar tu carga?" : "¿Listo para mudarte?"}
            </p>
            <QuoteWidget theme="light" load={post.quoteLoad} />
          </div>
        )}

        {/* Back link */}
        <div className="mt-8">
          <Link href="/blog" className="text-indigo-600 text-sm hover:underline">
            ← Volver al blog
          </Link>
        </div>
      </div>
      <LandingFooter />
    </main>
  );
}
