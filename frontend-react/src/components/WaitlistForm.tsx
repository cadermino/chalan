"use client";

import { useState } from "react";

interface Props {
  source: string;
  title?: string;
  description?: string;
}

export function WaitlistForm({
  source,
  title = "¿Te interesa la mudanza compartida?",
  description = "Déjanos tu correo y te avisamos cuando esté disponible en Chalán.",
}: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-8 mt-12">
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm mb-6">{description}</p>

      {status === "success" ? (
        <div className="flex items-center gap-3 text-green-700 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-medium">¡Listo! Te avisaremos cuando esté disponible.</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            required
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors shrink-0"
          >
            {status === "loading" ? "Guardando..." : "Avísame"}
          </button>
        </form>
      )}

      {status === "error" && (
        <p className="text-red-500 text-xs mt-3">Hubo un error, intenta nuevamente.</p>
      )}
    </div>
  );
}
