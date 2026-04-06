import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import Link from "next/link";
import { getPost, getAllSlugs } from "@/lib/blog";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { BreadcrumbJsonLd } from "@/components/Breadcrumbs";

interface Props {
  params: Promise<{ slug: string }>;
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
      url: `https://chalan.pe/blog/${slug}`,
      type: "article",
      publishedTime: post.date,
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

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: { "@type": "Organization", name: "Chalán" },
    publisher: {
      "@type": "Organization",
      name: "Chalán",
      url: "https://chalan.pe",
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://chalan.pe/blog/${slug}` },
  };

  return (
    <main id="main-content" className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <Navbar />

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
          prose-blockquote:border-indigo-300 prose-blockquote:text-gray-600">
          <MDXRemote source={post.content} />
        </article>

        {/* CTA post-article */}
        <div className="mt-16 bg-indigo-950 text-white rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-3">¿Listo para mudarte?</h2>
          <p className="text-white/70 mb-6">
            Cotiza tu mudanza o flete gratis. Compara precios y reserva en minutos.
          </p>
          <Link
            href="/order/step-one"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-amber-400 text-indigo-950 font-semibold hover:bg-amber-300 transition-colors"
          >
            Cotizar mudanza
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Back link */}
        <div className="mt-8">
          <Link href="/blog" className="text-indigo-600 text-sm hover:underline">
            ← Volver al blog
          </Link>
        </div>
      </div>
      <Footer />
    </main>
  );
}
