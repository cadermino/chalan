// Misma paleta "pizarra oscura" que la landing (frontend-react/src/app/landing.css),
// para que el formulario se sienta parte del mismo sitio.
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#1f2632',
        paper2: '#2a3344',
        line: '#3a4558',
        lineStrong: '#4a5568',
        ink: '#c8c0b4',
        inkStrong: '#f3ede2',
        inkSoft: '#9aa5b4',
        mute: '#7a8899',
        accent: '#2fa55f',
        accentSoft: '#1a3328',
        danger: '#e5736b',
      },
      fontFamily: {
        sans: ['"Inter Tight"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
