import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
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
    },
  }
})
