import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chalán - Mudanzas confiables",
  description: "Encuentra el mejor servicio de mudanza con reseñas verificadas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
