import Link from "next/link";

export const metadata = {
  title: "Nosotros - Chalán",
  description:
    "Chalán es una plataforma digital que facilita el requerimiento de movilidad para mudanzas locales y foráneas.",
};

export default function Nosotros() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Nosotros</h1>

        <div className="space-y-6 text-gray-700 leading-relaxed">
          <p>
            <strong>Chalán</strong> es una plataforma digital que facilita
            (automatiza) el requerimiento de movilidad para mudanzas locales y
            foráneas brindando una lista de vehículos donde mostramos precio y
            tamaño, además de una descripción del vehículo.
          </p>

          <p>
            Si no contamos con cobertura para la zona y horario que el usuario
            indica, un chalán buscará personalmente hasta tres opciones y lo
            enviará al cliente para que pueda elegir el que más le convenga.
          </p>

          <p>Lo que requerimos del cliente es:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Las direcciones de donde y hacia donde se quiere mudar</li>
            <li>Los pisos de las viviendas</li>
            <li>La fecha de la mudanza</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
