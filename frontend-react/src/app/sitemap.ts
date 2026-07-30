import { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/blog';
import { getApiBase } from '@/lib/api';

// Last real content change per static page (update when a page's copy changes).
const LAST_MODIFIED: Record<string, string> = {
  '/': '2026-07-22',
  '/nosotros': '2026-04-29',
  '/contacto': '2026-04-29',
  '/preguntas-frecuentes': '2026-05-25',
  '/reviews': '2026-04-06',
  '/aviso-de-privacidad': '2026-06-23',
  '/terminos-y-condiciones': '2026-06-23',
  '/cotizar-mudanza': '2026-07-22',
  '/mudanzas-lima': '2026-07-22',
  '/mudanzas-huancayo': '2026-07-22',
  '/fletes-peru': '2026-07-22',
  '/como-funciona': '2026-07-22',
  '/embalaje-profesional': '2026-07-02',
};

async function getCompanies(): Promise<{ id: number; last_review_date: string | null }[]> {
  try {
    const res = await fetch(`${getApiBase()}/api/v1/reviews/companies`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://chalan.pe';
  const companies = await getCompanies();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: LAST_MODIFIED['/'],
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/nosotros`,
      lastModified: LAST_MODIFIED['/nosotros'],
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contacto`,
      lastModified: LAST_MODIFIED['/contacto'],
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/preguntas-frecuentes`,
      lastModified: LAST_MODIFIED['/preguntas-frecuentes'],
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/reviews`,
      lastModified: LAST_MODIFIED['/reviews'],
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/aviso-de-privacidad`,
      lastModified: LAST_MODIFIED['/aviso-de-privacidad'],
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terminos-y-condiciones`,
      lastModified: LAST_MODIFIED['/terminos-y-condiciones'],
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/cotizar-mudanza`,
      lastModified: LAST_MODIFIED['/cotizar-mudanza'],
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/mudanzas-lima`,
      lastModified: LAST_MODIFIED['/mudanzas-lima'],
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/mudanzas-huancayo`,
      lastModified: LAST_MODIFIED['/mudanzas-huancayo'],
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/fletes-peru`,
      lastModified: LAST_MODIFIED['/fletes-peru'],
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/como-funciona`,
      lastModified: LAST_MODIFIED['/como-funciona'],
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/embalaje-profesional`,
      lastModified: LAST_MODIFIED['/embalaje-profesional'],
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];

  const companyPages: MetadataRoute.Sitemap = companies.map((company) => ({
    url: `${baseUrl}/reviews/${company.id}`,
    // Freshness = date of that company's most recent review
    lastModified: company.last_review_date ? new Date(company.last_review_date) : LAST_MODIFIED['/reviews'],
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  const posts = getAllPosts();
  const blogPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/blog`,
      // Blog index freshness = date of the most recent post
      lastModified: posts[0]?.date ? new Date(posts[0].date) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    ...posts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: post.date ? new Date(post.date) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];

  return [...staticPages, ...blogPages, ...companyPages];
}
