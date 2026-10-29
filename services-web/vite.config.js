import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { SHARE, SHARE_IMAGE } from './src/share.js'

// Los archivos del build viven bajo /services-web/ (así nginx puede mandar solo
// esa ruta y las del formulario a este contenedor), pero las pantallas se ven
// en /embalaje/cotizar/*, /armado/cotizar/*, /pintura/cotizar/*, /porcelanato/cotizar/*
// y /microcemento/cotizar/*. El servidor de desarrollo solo conoce la base, así que sin esto una URL del formulario daría 404 al recargar.
function formRoutesFallback() {
  return {
    name: 'form-routes-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && /^\/(embalaje|armado|pintura|porcelanato|microcemento)\//.test(req.url)) req.url = '/services-web/'
        next()
      })
    },
  }
}

// Un HTML por servicio, con su título y su vista previa al compartir (WhatsApp
// no ejecuta JavaScript y antes todos los links se veían como embalaje). nginx
// (services-web/nginx.conf) entrega <slug>.html en /<slug>/; index.html queda
// genérico para cualquier otra ruta.
function sharePages() {
  const meta = ({ title, description }) => [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="Chalán" />',
    `<meta property="og:image" content="${SHARE_IMAGE}" />`,
  ].join('\n    ')
  return {
    name: 'share-pages',
    apply: 'build',
    // Sobre el index.html ya escrito: es el que nombra los bundles con su hash.
    writeBundle(options) {
      const html = readFileSync(join(options.dir, 'index.html'), 'utf8')
      const withMeta = (page) => html
        .replace(/<title>[\s\S]*?<\/title>/, '')
        .replace(/<meta name="description"[^>]*>/, '')
        .replace('</head>', `  ${meta(page)}\n  </head>`)
      for (const page of Object.values(SHARE)) {
        writeFileSync(join(options.dir, `${page.slug}.html`), withMeta(page))
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), formRoutesFallback(), sharePages()],
  base: '/services-web/',
  // Los navegadores que apuntaba Vite 5 ('modules'). Vite 8 apunta por
  // defecto a Safari 16.4 y dejaría fuera iPhones que todavía se usan.
  build: {
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    // Se entra por el nginx local (http://local.chalan.mx); Vite bloquea los
    // hosts que no conoce desde 5.4.12.
    allowedHosts: ['local.chalan.mx'],
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
