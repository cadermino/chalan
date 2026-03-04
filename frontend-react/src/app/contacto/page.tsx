import Link from "next/link";

export const metadata = {
  title: "Contacto - Chalán",
  description:
    "Comunícate con Chalán para dudas, sugerencias o para trabajar con nosotros como socio.",
};

export default function Contacto() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <nav className="bg-indigo-950 text-white">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight">
              Chal<span className="text-amber-400">á</span>n
            </span>
          </Link>
          <Link
            href="/order/step-one"
            className="px-5 py-2 rounded-full bg-amber-400 text-indigo-950 font-semibold text-sm hover:bg-amber-300 transition-colors"
          >
            Cotizar mudanza
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-16 max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Contacto</h1>

        <div className="space-y-6 text-gray-700 leading-relaxed">
          <p>
            Si tienes alguna duda o sugerencia, comunícate con nosotros al{" "}
            <a href="tel:972643007" className="text-indigo-700 font-semibold hover:underline">
              972 643 007
            </a>{" "}
            o al correo{" "}
            <a
              href="mailto:carlos.calderon@chalan.pe"
              className="text-indigo-700 font-semibold hover:underline"
            >
              carlos.calderon@chalan.pe
            </a>
            .
          </p>

          <p>
            Si tienes vehículos de mudanza y quieres trabajar con nosotros como
            socio Chalán comunícate al{" "}
            <a href="tel:972643007" className="text-indigo-700 font-semibold hover:underline">
              972 643 007
            </a>{" "}
            en horarios de 8:00 a 20:00 horas.
          </p>
        </div>
      </div>
    </main>
  );
}
