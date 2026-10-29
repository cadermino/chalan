import "server-only";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { LoadType } from "@/components/QuoteWidget";

const POSTS_DIR = path.join(process.cwd(), "content", "blog");

const POST_CTAS = ["embalaje", "pintura", "microcemento", "porcelanato"] as const;
export type PostCta = (typeof POST_CTAS)[number];

// Un valor que no se conoce cae al cotizador de mudanza en vez de romper el post.
function parseCta(value: unknown): PostCta | undefined {
  return POST_CTAS.find((cta) => cta === value);
}

const QUOTE_LOADS: LoadType[] = ["moving", "items", "cargo", "vehicle"];

function parseQuoteLoad(value: unknown): LoadType | undefined {
  return QUOTE_LOADS.find((load) => load === value);
}

export interface PostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  // Última revisión de contenido real (no de una coma). Va a dateModified, al
  // sitemap y al "Actualizado el" del post. Sin él, Google ve la fecha de
  // publicación aunque el post se haya reescrito.
  updated?: string;
  keywords: string;
  category: string;
  readingTime: number;
  image?: string;
  waitlist?: boolean;
  // Qué llamado cierra el post. Sin valor: el cotizador de mudanza (o el
  // registro de transportistas, que se decide por categoría). "embalaje":
  // el formulario de /embalaje/cotizar, para los posts de embalaje, que
  // están repartidos en varias categorías. Los servicios a domicilio
  // (pintura, microcemento, porcelanato) cierran con su caja de HOME_SERVICES:
  // el formulario primero y WhatsApp de segunda opción.
  cta?: PostCta;
  // Qué viene marcado en el cotizador que cierra el post ("cargo" en los de
  // fletes). Sin valor: mudanza.
  quoteLoad?: LoadType;
}

export interface Post extends PostMeta {
  content: string;
}

function calcReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function getAllPosts(): PostMeta[] {
  if (!fs.existsSync(POSTS_DIR)) return [];

  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".mdx"));

  const posts = files.map((filename) => {
    const slug = filename.replace(/\.mdx$/, "");
    const filePath = path.join(POSTS_DIR, filename);
    const raw = fs.readFileSync(filePath, "utf8");
    const { data, content } = matter(raw);

    return {
      slug,
      title: data.title ?? slug,
      description: data.description ?? "",
      date: data.date ?? "",
      updated: data.updated,
      keywords: data.keywords ?? "",
      category: data.category ?? "Consejos",
      readingTime: calcReadingTime(content),
      image: data.image,
      waitlist: data.waitlist ?? false,
      cta: parseCta(data.cta),
      quoteLoad: parseQuoteLoad(data.quoteLoad),
    } as PostMeta;
  });

  return posts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getPost(slug: string): Post | null {
  const filePath = path.join(POSTS_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);

  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    date: data.date ?? "",
    updated: data.updated,
    keywords: data.keywords ?? "",
    category: data.category ?? "Consejos",
    readingTime: calcReadingTime(content),
    image: data.image,
    waitlist: data.waitlist ?? false,
    cta: parseCta(data.cta),
    quoteLoad: parseQuoteLoad(data.quoteLoad),
    content,
  };
}

export function getAllSlugs(): string[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""));
}
