import Link from "next/link";
import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { BreadcrumbJsonLd } from "@/components/Breadcrumbs";

export const metadata: Metadata = {
  title: "Blog de mudanzas y fletes en Perú | Chalán",
  description:
    "Guías, consejos y tips para tu mudanza en Perú. Descubre cuánto cuesta mudarse en Lima, cómo empacar, y mucho más.",
  keywords:
    "blog mudanzas peru, guia mudanza lima, tips mudanza, cuanto cuesta mudanza, consejos flete",
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    title: "Blog de mudanzas y fletes | Chalán",
    description:
      "Guías y tips para tu mudanza en Perú. Información útil antes de contratar un servicio.",
    url: "https://chalan.pe/blog",
  },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-PE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <main id="main-content" className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Navbar />
      <div className="container mx-auto px-6 py-16 max-w-4xl">
        <BreadcrumbJsonLd
          items={[
            { name: "Inicio", url: "https://chalan.pe" },
            { name: "Blog", url: "https://chalan.pe/blog" },
          ]}
        />

        <h1 className="text-4xl font-bold text-gray-900 mb-3">Blog</h1>
        <p className="text-lg text-gray-500 mb-12">
          Guías y consejos para tu mudanza o flete en Perú.
        </p>

        {posts.length === 0 ? (
          <p className="text-gray-400">Pronto publicaremos artículos.</p>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group block bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:border-indigo-200 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                    {post.category}
                  </span>
                  <span className="text-gray-400 text-sm">
                    {post.readingTime} min lectura
                  </span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 group-hover:text-indigo-700 transition-colors mb-2">
                  {post.title}
                </h2>
                <p className="text-gray-500 leading-relaxed mb-4">
                  {post.description}
                </p>
                <div className="flex items-center justify-between">
                  <time className="text-gray-400 text-sm" dateTime={post.date}>
                    {formatDate(post.date)}
                  </time>
                  <span className="text-indigo-600 font-medium text-sm group-hover:underline">
                    Leer artículo →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
