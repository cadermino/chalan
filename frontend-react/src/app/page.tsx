import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Chalán</h1>
          <div className="flex gap-4">
            <Link href="/reviews" className="hover:underline">
              Reseñas
            </Link>
            <Link
              href="/"
              className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50"
            >
              Cotizar mudanza
            </Link>
          </div>
        </nav>
        <div className="container mx-auto px-6 py-24 text-center">
          <h2 className="text-5xl font-bold mb-6">
            Mudanzas seguras y confiables
          </h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
            Encuentra mudanceros verificados con reseñas reales de otros
            clientes. Compara precios y elige con confianza.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/"
              className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-3 rounded-lg text-lg font-medium transition-colors"
            >
              Solicitar cotización
            </Link>
            <Link
              href="/reviews"
              className="bg-white/10 hover:bg-white/20 border border-white/30 text-white px-8 py-3 rounded-lg text-lg font-medium transition-colors"
            >
              Ver reseñas
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-20">
        <h3 className="text-3xl font-bold text-center mb-12">
          ¿Por qué elegir Chalán?
        </h3>
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon="⭐"
            title="Reseñas verificadas"
            description="Lee opiniones reales de clientes que ya realizaron su mudanza"
          />
          <FeatureCard
            icon="💰"
            title="Precios competitivos"
            description="Compara cotizaciones de múltiples empresas de mudanza"
          />
          <FeatureCard
            icon="🛡️"
            title="Servicio garantizado"
            description="Todas las empresas están verificadas y cumplen estándares de calidad"
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="container mx-auto px-6 text-center">
          <p>&copy; {new Date().getFullYear()} Chalán. Todos los derechos reservados.</p>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-shadow">
      <div className="text-4xl mb-4">{icon}</div>
      <h4 className="text-xl font-semibold mb-2">{title}</h4>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
