import Link from "next/link";
import { Footer } from "@/components/Footer";

export default function ReviewsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-blue-600">
            Chalán
          </Link>
          <div className="flex gap-4 items-center">
            <Link href="/reviews" className="text-blue-600 font-medium">
              Reseñas
            </Link>
            <Link
              href="/"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
            >
              Cotizar mudanza
            </Link>
          </div>
        </div>
      </nav>
      {children}
      <Footer />
    </>
  );
}
