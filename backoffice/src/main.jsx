import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import App from './App'
import './index.css'

// Microsoft Clarity. Solo en el build de producción, para no llenar el
// proyecto con sesiones del entorno local.
if (import.meta.env.PROD) {
  (function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) };
    t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, 'clarity', 'script', 'yqkk0rf3sv');
}

// En Chrome, la rueda o el trackpad sobre un campo numérico activo cambia su
// valor en vez de bajar la página: a la tarifa de una empresa se le puso solo
// un recargo de fin de semana de 68 % y 0 por km. Al girar la rueda encima de
// un número se le quita el foco, así la página baja y el valor queda igual.
document.addEventListener('wheel', (e) => {
  const el = document.activeElement
  if (el?.type === 'number' && el === e.target) el.blur()
}, { passive: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.VITE_BASE_PATH || '/'}>
        <App />
        <Toaster position="top-right" />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
