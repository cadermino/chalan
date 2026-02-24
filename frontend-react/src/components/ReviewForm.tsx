"use client";

import { useState } from "react";

interface ReviewFormProps {
  carrierCompanyId: number;
}

export function ReviewForm({ carrierCompanyId }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [orderId, setOrderId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

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
    if (!orderId.trim()) {
      setError("Ingresa tu número de orden");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrier_company_id: carrierCompanyId,
          order_id: parseInt(orderId),
          rating,
          comment: comment.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al enviar la reseña");
      }

      setSuccess(true);
      setRating(0);
      setComment("");
      setOrderId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar la reseña");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-4">
        <p className="text-green-600 font-medium mb-2">
          ¡Gracias por tu reseña!
        </p>
        <button
          onClick={() => setSuccess(false)}
          className="text-blue-600 hover:underline text-sm"
        >
          Escribir otra reseña
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Order ID */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Número de orden
        </label>
        <input
          type="text"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          placeholder="Ej: 123"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Star selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Calificación
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className={`text-2xl transition-colors ${
                star <= (hoverRating || rating)
                  ? "text-amber-500"
                  : "text-gray-300"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      {/* Comment */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Comentario
        </label>
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
