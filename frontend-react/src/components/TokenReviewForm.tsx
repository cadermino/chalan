"use client";

import { useEffect, useState } from "react";

interface TokenReviewFormProps {
  token: string;
}

export function TokenReviewForm({ token }: TokenReviewFormProps) {
  const [loading, setLoading] = useState(true);
  const [verifyError, setVerifyError] = useState("");
  const [carrierName, setCarrierName] = useState("");
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
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
        body: JSON.stringify({ token, rating, comment: comment.trim() }),
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
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className={`text-2xl transition-colors ${
                star <= (hoverRating || rating) ? "text-blue-500" : "text-gray-300"
              }`}
            >
              ★
            </button>
          ))}
        </div>
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
