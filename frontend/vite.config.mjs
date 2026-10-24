import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

// Los nombres de siempre: el servidor de Perú arma este build con un
// frontend/.env.production propio y con ENV del Dockerfile, todos VUE_APP_*.
// Cambiarles el prefijo obligaría a tocar el servidor en el mismo deploy.
const ENV_PREFIX = ['VITE_', 'VUE_APP_'];
const DEFAULT_GA_ID = 'G-72KVLDWMQD';

// En desarrollo los archivos de Vite viven bajo esta base, así el nginx local
// manda una sola ruta más a este contenedor; las pantallas siguen en /order,
// /acceso, etc. (las rutas de router/index.js), que nginx ya le manda.
const DEV_BASE = '/vue-dev/';
const APP_ROUTES = /^\/(order|carrier-company|dashboard|register-login|login|register|quotation|acceso)(\/|\?|$)/;

// El servidor de desarrollo solo conoce la base: sin esto una URL de la app
// daría 404 al recargar. Mismo truco que services-web/vite.config.js.
function appRoutesFallback() {
  return {
    name: 'app-routes-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && APP_ROUTES.test(req.url)) req.url = DEV_BASE;
        next();
      });
    },
  };
}

// index.html era una plantilla de vue-cli (<% if %>). Inspectlet y Clarity
// graban solo en producción; GA también, salvo que VUE_APP_GA_ID lo encienda
// en local para validar eventos en DebugView (y ahí va con debug_mode).
function indexHtml(mode, env) {
  const production = mode === 'production';
  const analytics = production || Boolean(env.VUE_APP_GA_ID);
  return {
    name: 'index-html',
    transformIndexHtml(html) {
      return html
        .replace(/<!-- if:production -->([\s\S]*?)<!-- endif -->/g, (_, block) => (production ? block : ''))
        .replace(/<!-- if:analytics -->([\s\S]*?)<!-- endif -->/g, (_, block) => (analytics ? block : ''))
        .replace(/__GA_ID__/g, env.VUE_APP_GA_ID || DEFAULT_GA_ID)
        .replace('__GA_DEBUG__', production ? '' : 'debug_mode: true,');
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), ENV_PREFIX);
  return {
    base: command === 'serve' ? DEV_BASE : '/',
    envPrefix: ENV_PREFIX,
    plugins: [vue(), appRoutesFallback(), indexHtml(mode, env)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      // Lo que corría con vue-cli (core-js + babel): iPhones con iOS 13 en
      // adelante siguen pudiendo crear una orden.
      target: ['es2019', 'safari13'],
      cssTarget: ['safari13'],
      rollupOptions: {
        output: {
          // nginx sirve el Vue desde /js, /css e /img con caché eterna
          // (nginx.chalan-prod-peru.conf); /assets, el default de Vite, no
          // está y caería en Next.js.
          entryFileNames: 'js/[name].[hash].js',
          chunkFileNames: 'js/[name].[hash].js',
          assetFileNames: ({ name, names = [name] }) => (names.some(n => n && n.endsWith('.css'))
            ? 'css/[name].[hash][extname]'
            : 'img/[name].[hash][extname]'),
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 8080,
      // Se entra por el nginx local; Vite bloquea los hosts que no conoce.
      allowedHosts: ['local.chalan.mx', 'localhost'],
      watch: {
        usePolling: true,
      },
    },
  };
});
