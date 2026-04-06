import Link from "next/link";

export function Navbar() {
  return (
    <nav className="bg-indigo-950 text-white" aria-label="Navegación principal">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold tracking-tight">
            Chal<span className="text-amber-400">á</span>n
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/blog"
            className="text-white/80 hover:text-white transition-colors hidden sm:inline font-medium"
          >
            Blog
          </Link>
          <Link
            href="/reviews"
            className="text-white/80 hover:text-white transition-colors hidden sm:inline font-medium"
          >
            Reseñas
          </Link>
          <Link
            href="/contacto"
            className="text-white/80 hover:text-white transition-colors hidden sm:inline font-medium"
          >
            Contacto
          </Link>
          <Link
            href="/nosotros"
            className="text-white/80 hover:text-white transition-colors hidden sm:inline font-medium"
          >
            Nosotros
          </Link>
          <Link
            href="/order/step-one"
            className="px-5 py-2 rounded-full bg-amber-400 text-indigo-950 font-semibold text-sm hover:bg-amber-300 transition-colors"
          >
            Cotizar mudanza
          </Link>
        </div>
      </div>
    </nav>
  );
}
