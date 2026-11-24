import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const SHARE_IMAGE = 'https://chalan-public.s3.amazonaws.com/home/truck-list-fb.png'

// Vista previa de los links del backoffice que se mandan por WhatsApp. WhatsApp
// no ejecuta JavaScript y el index.html no tenía ninguna: el link de cotizar un
// servicio salía sin título. El build escribe una copia del index por link y
// nginx entrega la de cada ruta ($backoffice_page en nginx.chalan-prod-peru.conf).
const SHARE_PAGES = {
  'carrier-view.html': {
    title: 'Solicitud para cotizar | Chalán',
    description: 'Mira qué hay que hacer, el distrito y la fecha, y manda tu precio.',
  },
  'restablecer.html': {
    title: 'Crea tu contraseña | Chalán',
    description: 'Entra para crear o cambiar la contraseña de tu cuenta de Chalán.',
  },
}

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
      for (const [file, page] of Object.entries(SHARE_PAGES)) {
        writeFileSync(join(options.dir, file), html
          .replace(/<title>[\s\S]*?<\/title>/, '')
          .replace('</head>', `  ${meta(page)}\n  </head>`))
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), sharePages()],
    base: env.VITE_BASE_PATH || '/',
    // Los navegadores que apuntaba Vite 5 ('modules'). Vite 8 apunta por
    // defecto a Safari 16.4 y dejaría fuera iPhones que todavía se usan.
    build: {
      target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      watch: {
        usePolling: true,
      },
      // El service worker de los avisos push lo sirve la app de Vue en
      // /quotation/ (components/PushOptIn.jsx). En producción es el mismo
      // dominio; en local el backoffice corre aparte, así que se lo pide a Vue.
      proxy: {
        '/quotation/': {
          target: env.VUE_DEV_URL || 'http://vuex:8080',
          rewrite: (path) => `/vue-dev${path}`,
        },
      },
    },
  }
})
