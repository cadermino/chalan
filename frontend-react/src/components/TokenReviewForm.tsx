"use client";

import { useEffect, useState } from "react";

interface TokenReviewFormProps {
  token: string;
}

function StarRating({
  value,
  onChange,
  color,
}: {
  value: number;
  onChange: (v: number) => void;
  color: "blue" | "indigo";
}) {
  const [hover, setHover] = useState(0);
  const activeClass = color === "blue" ? "text-blue-500" : "text-indigo-500";

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className={`text-2xl transition-colors ${
            star <= (hover || value) ? activeClass : "text-gray-300"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function TokenReviewForm({ token }: TokenReviewFormProps) {
  const [loading, setLoading] = useState(true);
  const [verifyError, setVerifyError] = useState("");
  const [carrierName, setCarrierName] = useState("");
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [platformRating, setPlatformRating] = useState(0);
  const [platformComment, setPlatformComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/v1/reviews/verify/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Link inválido o expirado");
        setCarrierName(data.carrier_company_name);
        setAlreadyReviewed(data.already_reviewed);
      })
      .catch((err) =>
        setVerifyError(err instanceof Error ? err.message : "Link inválido o expirado")
      )
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (rating === 0) {
      setError("Selecciona una calificación");
      return;
    }
    if (!comment.trim()) {
      setError("Escribe un comentario");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          rating,
          comment: comment.trim(),
          ...(platformRating > 0 && { platform_rating: platformRating }),
          ...(platformComment.trim() && { platform_comment: platformComment.trim() }),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al enviar la reseña");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar la reseña");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-gray-500 text-sm">Cargando...</p>;
  }

  if (verifyError) {
    return <p className="text-red-600 text-sm">{verifyError}</p>;
  }

  if (alreadyReviewed || success) {
    return (
      <div className="text-center py-4">
        <p className="text-green-600 font-medium">
          {success ? "¡Gracias por tu reseña!" : "Ya publicaste una reseña para esta orden."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">
        Cuéntanos cómo fue tu experiencia con{" "}
        <span className="font-semibold">{carrierName}</span>.
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Calificación</label>
        <StarRating value={rating} onChange={setRating} color="blue" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Comentario</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="¿Cómo fue tu experiencia con la mudanza?"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="flex items-center gap-3 py-1">
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-[11px] font-semibold tracking-wide text-gray-400">
          Y TU EXPERIENCIA CON CHALÁN
        </span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      <div className="bg-indigo-50 rounded-lg p-3.5">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-800 mb-2">
          ¿Cómo estuvo usar la plataforma?
          <span className="text-[10px] font-bold tracking-wide uppercase bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">
            Nuevo
          </span>
        </label>
        <StarRating value={platformRating} onChange={setPlatformRating} color="indigo" />
        <textarea
          value={platformComment}
          onChange={(e) => setPlatformComment(e.target.value)}
          rows={2}
          placeholder="Cotizar, elegir y pagar — ¿fue fácil? (opcional)"
          className="mt-2.5 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? "Enviando..." : "Enviar reseña"}
      </button>
    </form>
  );
}
