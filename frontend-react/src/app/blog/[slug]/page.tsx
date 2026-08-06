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
    dateModified: publishedIso,
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
          <time className="text-gray-400 text-sm" dateTime={post.date}>
            {formatDate(post.date)}
          </time>
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
          <MDXRemote source={post.content} options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }} />
        </article>

        {/* Waitlist — solo para posts con waitlist: true */}
        {post.waitlist && (
          <WaitlistForm source={slug} />
        )}

        {/* CTA post-article — registro para posts de transportistas, cotizador para el resto */}
        {post.category === "Transportistas" ? (
          <div className="mt-16">
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">¿Listo para recibir pedidos?</p>
            <div className="chalan-landing">
              <CarrierSignupForm />
            </div>
          </div>
        ) : (
          <div className="mt-16">
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">¿Listo para mudarte?</p>
            <QuoteWidget theme="light" />
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
