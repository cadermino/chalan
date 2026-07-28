import Link from 'next/link'
import { getApiBase } from '@/lib/api'

interface RecentReview {
  id: number
  rating: number
  comment: string
  customer_name: string
  carrier_company_name: string
  carrier_company_id: number
}

async function getRecentReviews(limit: number): Promise<RecentReview[]> {
  try {
    const res = await fetch(`${getApiBase()}/api/v1/reviews/recent`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const reviews: RecentReview[] = await res.json()
    return reviews.slice(0, limit)
  } catch {
    return []
  }
}

function Star() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

// Column spans (of 12) per card count, so cards fill the row evenly.
// Even widths — review text length is real/variable, not curated, so an
// asymmetric layout (e.g. 5/4/3) reads as broken rather than editorial.
const SPANS_BY_COUNT: Record<number, string[]> = {
  1: ['span-12'],
  2: ['span-6', 'span-6'],
  3: ['span-4', 'span-4', 'span-4'],
}

interface TestimonialsProps {
  limit?: number
  /** 'landing' matches the dark editorial homepage; 'light' matches the Tailwind content pages. */
  variant?: 'landing' | 'light'
  /** Section index shown in the landing variant's eyebrow, e.g. '01'. */
  sectionNumber?: string
}

export async function Testimonials({ limit = 3, variant = 'landing', sectionNumber = '03' }: TestimonialsProps) {
  const reviews = await getRecentReviews(limit)
  if (reviews.length === 0) return null

  if (variant === 'light') {
    return (
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Lo que dicen nuestros clientes
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {reviews.map((r) => (
            <Link
              href={`/reviews/${r.carrier_company_id}`}
              key={r.id}
              className="block bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:border-indigo-200 transition-colors"
            >
              <div className="flex gap-0.5 text-amber-400 mb-3">
                {Array.from({ length: r.rating }).map((_, s) => <Star key={s} />)}
              </div>
              <p className="text-gray-700 mb-4">&ldquo;{r.comment}&rdquo;</p>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-gray-900">{r.customer_name}</span>
                <span className="text-gray-400">{r.carrier_company_name}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    )
  }

  const spans = SPANS_BY_COUNT[reviews.length] ?? reviews.map(() => 'span-4')

  return (
    <section className="block">
      <div className="wrap">
        <div className="section-head">
          <div className="num">{sectionNumber} / Reseñas</div>
          <h2 className="h-section">Verificadas,<br />no inventadas.</h2>
        </div>
        <div className="testimonials">
          {reviews.map((r, i) => (
            <Link href={`/reviews/${r.carrier_company_id}`} key={r.id} className={`t-card ${spans[i]}`}>
              <div className="t-stars">
                {Array.from({ length: r.rating }).map((_, s) => <Star key={s} />)}
              </div>
              <p className="t-quote">&ldquo;{r.comment}&rdquo;</p>
              <div className="t-meta">
                <span className="who">{r.customer_name}</span>
                <span className="where">MUDANZA CON {r.carrier_company_name.toUpperCase()}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
