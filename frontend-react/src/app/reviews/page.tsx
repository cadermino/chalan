import Link from "next/link";
import { StarRating } from "@/components/StarRating";
import { getApiBase } from "@/lib/api";

interface Review {
  id: number;
  rating: number;
  comment: string;
  customer_name: string;
  created_date: string;
  carrier_company_name: string;
  carrier_company_id: number;
}

interface CarrierCompanyWithRating {
  id: number;
  name: string;
  description: string;
  cover_image: string | null;
  average_rating: number;
  total_reviews: number;
}

async function getAllCompanies(): Promise<CarrierCompanyWithRating[]> {
  try {
    const res = await fetch(`${getApiBase()}/api/v1/reviews/companies`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getRecentReviews(): Promise<Review[]> {
  try {
    const res = await fetch(`${getApiBase()}/api/v1/reviews/recent`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function ReviewsPage() {
  const [companies, reviews] = await Promise.all([
    getAllCompanies(),
    getRecentReviews(),
  ]);

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
        <h1 className="text-4xl font-bold mb-2">Reseñas de mudanceros</h1>
        <p className="text-gray-600 mb-10">
          Opiniones reales de clientes que realizaron su mudanza con Chalán
        </p>

        {/* All Companies with Ratings */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6">
            Calificaciones por empresa
          </h2>
          {companies.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {companies.map((company) => (
                <Link
                  key={company.id}
                  href={`/reviews/${company.id}`}
                  className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl flex-shrink-0">
                      {company.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-lg truncate">
                        {company.name}
                      </h3>
                      {company.total_reviews > 0 ? (
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-gray-800">
                            {company.average_rating.toFixed(1)}
                          </span>
                          <div>
                            <StarRating rating={company.average_rating} />
                            <p className="text-xs text-gray-500">
                              {company.total_reviews}{" "}
                              {company.total_reviews === 1
                                ? "reseña"
                                : "reseñas"}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">
                          Sin calificaciones aún
                        </p>
                      )}
                    </div>
                  </div>
                  {company.description && (
                    <p className="text-gray-600 text-sm line-clamp-2">
                      {company.description}
                    </p>
                  )}
                  <div className="mt-4 text-blue-600 text-sm font-medium">
                    Ver reseñas →
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl p-12 text-center text-gray-500">
              <p className="text-lg">No hay empresas registradas.</p>
            </div>
          )}
        </section>

        {/* Recent Reviews */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Reseñas recientes</h2>
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-white rounded-xl p-6 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-medium">{review.customer_name}</p>
                      <Link
                        href={`/reviews/${review.carrier_company_id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {review.carrier_company_name}
                      </Link>
                    </div>
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
              <p className="text-lg">Aún no hay reseñas.</p>
              <p className="text-sm mt-2">
                ¡Sé el primero en dejar una reseña después de tu mudanza!
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
