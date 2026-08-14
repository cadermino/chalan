import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

if (import.meta.env.PROD) {
  window.__insp = window.__insp || [];
  window.__insp.push(['wid', 1681414770]);
  const ldinsp = () => {
    if (typeof window.__inspld !== 'undefined') return;
    window.__inspld = 1;
    const insp = document.createElement('script');
    insp.type = 'text/javascript';
    insp.async = true;
    insp.id = 'inspsync';
    insp.src = `${document.location.protocol === 'https:' ? 'https' : 'http'}://cdn.inspectlet.com/inspectlet.js?wid=1681414770&r=${Math.floor(new Date().getTime() / 3600000)}`;
    const x = document.getElementsByTagName('script')[0];
    x.parentNode.insertBefore(insp, x);
  };
  setTimeout(ldinsp, 0);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.VITE_BASE_PATH || '/'}>
      <App />
      <Toaster position="top-right" />
    </BrowserRouter>
  </React.StrictMode>,
)
