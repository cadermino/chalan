// Fuentes del sitio, servidas desde el repo (src/fonts, subconjunto latin, licencia
// OFL) en vez de next/font/google: así el build no baja nada de Google, que
// fallaba a veces en el servidor ("Cannot read properties of null (reading '1')").
// Para cambiar o agregar una fuente: bajar su .woff2 latin de Google Fonts a
// src/fonts y declararla aquí. Las tres de landing se comparten entre páginas.
import localFont from 'next/font/local'

export const instrumentSerif = localFont({
  src: [
    { path: '../fonts/InstrumentSerif-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/InstrumentSerif-Italic.woff2', weight: '400', style: 'italic' },
  ],
  variable: '--font-instrument-serif',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
})

export const interTight = localFont({
  src: '../fonts/InterTight-Variable.woff2',
  weight: '100 900',
  variable: '--font-inter-tight',
  display: 'swap',
  fallback: ['Arial', 'sans-serif'],
})

export const jetbrainsMono = localFont({
  src: '../fonts/JetBrainsMono-Variable.woff2',
  weight: '100 800',
  variable: '--font-jetbrains-mono',
  display: 'swap',
  fallback: ['ui-monospace', 'monospace'],
})

export const outfit = localFont({
  src: '../fonts/Outfit-Variable.woff2',
  weight: '100 900',
  variable: '--font-outfit',
  display: 'swap',
  fallback: ['Arial', 'sans-serif'],
})
