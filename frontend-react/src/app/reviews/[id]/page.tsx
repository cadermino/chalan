import Link from "next/link";
import { StarRating } from "@/components/StarRating";
import { ReviewForm } from "@/components/ReviewForm";
import { getApiBase } from "@/lib/api";

interface Review {
  id: number;
  rating: number;
  comment: string;
  customer_name: string;
  created_date: string;
}

interface CompanyDetail {
  id: number;
  name: string;
  description: string;
  cover_image: string | null;
  phone: string;
  email: string;
  average_rating: number;
  total_reviews: number;
  reviews: Review[];
}

async function getCompanyReviews(id: string): Promise<CompanyDetail | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/v1/reviews/company/${id}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function CompanyReviewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await getCompanyReviews(id);

  if (!company) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Empresa no encontrada</h1>
          <Link href="/reviews" className="text-blue-600 hover:underline">
            ← Volver a reseñas
          </Link>
        </div>
      </main>
    );
  }

  const ratingDistribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: company.reviews.filter((r) => r.rating === star).length,
    percentage:
      company.total_reviews > 0
        ? (company.reviews.filter((r) => r.rating === star).length /
            company.total_reviews) *
          100
        : 0,
  }));

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-blue-600">
            Chalán
          </Link>
          <div className="flex gap-4 items-center">
            <Link href="/reviews" className="text-blue-600 font-medium">
              Reseñas
            </Link>
            <Link
              href="/"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
            >
              Cotizar mudanza
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-12">
        <Link
          href="/reviews"
          className="text-blue-600 hover:underline text-sm mb-6 inline-block"
        >
          ← Volver a reseñas
        </Link>

        {/* Company Header */}
        <div className="bg-white rounded-xl p-8 shadow-sm mb-8">
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-3xl flex-shrink-0">
              {company.name.charAt(0)}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{company.name}</h1>
              <p className="text-gray-600 mb-4">{company.description}</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold">
                    {company.average_rating.toFixed(1)}
                  </span>
                  <div>
                    <StarRating rating={company.average_rating} size="lg" />
                    <p className="text-sm text-gray-500">
                      {company.total_reviews} reseñas
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Rating Distribution */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
              <h3 className="font-semibold mb-4">Distribución de calificaciones</h3>
              <div className="space-y-2">
                {ratingDistribution.map(({ star, count, percentage }) => (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-sm w-3">{star}</span>
                    <span className="text-amber-500 text-sm">★</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-amber-500 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-500 w-8">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Write Review Form */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold mb-4">Escribe una reseña</h3>
              <ReviewForm carrierCompanyId={company.id} />
            </div>
          </div>

          {/* Reviews List */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4">
              Todas las reseñas ({company.total_reviews})
            </h2>
            {company.reviews.length > 0 ? (
              <div className="space-y-4">
                {company.reviews.map((review) => (
                  <div
                    key={review.id}
                    className="bg-white rounded-xl p-6 shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <p className="font-medium">{review.customer_name}</p>
                      <div className="flex items-center gap-2">
                        <StarRating rating={review.rating} />
                        <span className="text-sm text-gray-500">
                          {new Date(review.created_date).toLocaleDateString(
                            "es-PE"
                          )}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-700">{review.comment}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl p-12 text-center text-gray-500">
                <p>Esta empresa aún no tiene reseñas.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
