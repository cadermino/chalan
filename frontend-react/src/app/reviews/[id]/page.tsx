import Link from "next/link";
import { StarRating } from "@/components/StarRating";
import { ReviewForm } from "@/components/ReviewForm";
import { getApiBase } from "@/lib/api";
import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/Breadcrumbs";

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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const company = await getCompanyReviews(id);
  
  if (!company) {
    return {
      title: "Empresa no encontrada - Chalán",
      description: "La empresa transportista que buscas no existe.",
    };
  }

  const avgRating = company.average_rating ? company.average_rating.toFixed(1) : "0";
  const reviewCount = company.total_reviews || 0;
  
  return {
    title: `${company.name} - Reviews y calificaciones (${avgRating}⭐) - Chalán`,
    description: 
      `Lee las ${reviewCount} reseñas de ${company.name}, empresa de mudanzas y fletes en Perú. Calificación promedio: ${avgRating}/5 estrellas.`,
    keywords: 
      `${company.name}, reviews ${company.name}, mudanzas lima, empresa transporte peru, calificaciones`,
    alternates: {
      canonical: `/reviews/${id}`,
    },
    openGraph: {
      title: `${company.name} - Reviews (${avgRating}⭐)`,
      description: 
        `Lee las reseñas de ${company.name}, empresa de mudanzas en Perú. ${reviewCount} reviews - ${avgRating}/5 estrellas.`,
      url: `https://chalan.pe/reviews/${id}`,
      images: company.cover_image ? [
        {
          url: company.cover_image,
          alt: `Logo de ${company.name}`,
        },
      ] : undefined,
    },
  };
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

  // JSON-LD structured data
  const businessJsonLd = {
    "@context": "https://schema.org",
    "@type": "MovingCompany",
    name: company.name,
    description: company.description,
    telephone: company.phone,
    email: company.email,
    image: company.cover_image,
    aggregateRating: company.total_reviews > 0 ? {
      "@type": "AggregateRating",
      ratingValue: company.average_rating.toFixed(1),
      reviewCount: company.total_reviews,
      bestRating: "5",
      worstRating: "1",
    } : undefined,
  };

  const reviewsJsonLd = company.reviews.map((review) => ({
    "@context": "https://schema.org",
    "@type": "Review",
    reviewRating: {
      "@type": "Rating",
      ratingValue: review.rating,
      bestRating: "5",
      worstRating: "1",
    },
    author: {
      "@type": "Person", 
      name: review.customer_name,
    },
    reviewBody: review.comment,
    datePublished: review.created_date,
    itemReviewed: {
      "@type": "MovingCompany",
      name: company.name,
    },
  }));

  return (
    <main className="min-h-screen bg-gray-50">
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", url: "https://chalan.pe" },
          { name: "Reseñas", url: "https://chalan.pe/reviews" },
          { name: company.name, url: `https://chalan.pe/reviews/${id}` },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd) }}
      />
      {reviewsJsonLd.map((reviewJson, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewJson) }}
        />
      ))}
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
            {company.cover_image ? (
              <img
                src={company.cover_image}
                alt={`Logo de ${company.name}, empresa de mudanzas`}
                width={80}
                height={80}
                loading="lazy"
                className="w-20 h-20 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-3xl flex-shrink-0">
                {company.name.charAt(0)}
              </div>
            )}
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
              <h2 className="font-semibold mb-4">Distribución de calificaciones</h2>
              <div className="space-y-2">
                {ratingDistribution.map(({ star, count, percentage }) => (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-sm w-3">{star}</span>
                    <span className="text-blue-500 text-sm">★</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
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
              <h2 className="font-semibold mb-4">Escribe una reseña</h2>
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
