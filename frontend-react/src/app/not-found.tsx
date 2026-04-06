import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Página no encontrada | Chalán",
  description: "Lo sentimos, la página que buscas no existe. Vuelve al inicio o cotiza tu mudanza.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function NotFound() {
  return (
    <main id="main-content" className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      <Navbar />

      <div className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-6 py-20 max-w-2xl text-center">
          <p className="text-8xl font-bold text-indigo-100 select-none mb-2">404</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Página no encontrada
          </h1>
          <p className="text-gray-500 mb-10">
            Lo sentimos, la página que buscas no existe o fue movida.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="px-8 py-3 rounded-full bg-indigo-950 text-white font-semibold hover:bg-indigo-900 transition-colors"
            >
              Ir al inicio
            </Link>
            <Link
              href="/order/step-one"
              className="px-8 py-3 rounded-full bg-amber-400 text-indigo-950 font-semibold hover:bg-amber-300 transition-colors"
            >
              Cotizar mudanza
            </Link>
          </div>

          <div className="mt-16 grid sm:grid-cols-3 gap-4 text-left">
            <Link href="/como-funciona" className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:border-indigo-200 transition-colors group">
              <h2 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">¿Cómo funciona?</h2>
              <p className="text-gray-500 text-sm mt-1">Cotiza en 4 simples pasos</p>
            </Link>
            <Link href="/mudanzas-lima" className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:border-indigo-200 transition-colors group">
              <h2 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">Mudanzas en Lima</h2>
              <p className="text-gray-500 text-sm mt-1">Cobertura en los 43 distritos</p>
            </Link>
            <Link href="/preguntas-frecuentes" className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:border-indigo-200 transition-colors group">
              <h2 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">Preguntas frecuentes</h2>
              <p className="text-gray-500 text-sm mt-1">Resolvemos tus dudas</p>
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
