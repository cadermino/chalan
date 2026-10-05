import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Los archivos del build viven bajo /services-web/ (así nginx puede mandar solo
// esa ruta y las del formulario a este contenedor), pero las pantallas se ven
// en /embalaje/cotizar/*. El servidor de desarrollo solo conoce la base, así
// que sin esto una URL del formulario daría 404 al recargar.
function formRoutesFallback() {
  return {
    name: 'form-routes-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && req.url.startsWith('/embalaje')) req.url = '/services-web/'
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), formRoutesFallback()],
  base: '/services-web/',
  server: {
    host: '0.0.0.0',
    port: 5174,
    watch: {
      usePolling: true,
    },
    // La API principal, para desarrollar sin CORS. Dentro de Docker apunta al
    // contenedor `flask` (docker-compose.local.yml); fuera, a localhost.
    proxy: {
      '/api': process.env.DEV_API_PROXY_TARGET || 'http://localhost:8001',
    },
  },
})
