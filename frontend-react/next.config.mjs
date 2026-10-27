/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // En el servidor de Perú (924 MB de RAM) la revisión de tipos de `next build`
  // tardaba 26 minutos desde el swap; en local tarda segundos. Ahí se salta
  // (SKIP_TYPECHECK en Dockerfile.peru.prod) y `make deploy-peru` la corre en
  // local antes de subir. ESLint no está configurado: no hay nada que correr.
  typescript: { ignoreBuildErrors: process.env.SKIP_TYPECHECK === '1' },
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://flask:8001/api/:path*',
      },
    ];
  },
};

export default nextConfig;
