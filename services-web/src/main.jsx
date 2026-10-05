import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { RequestProvider } from './context/RequestContext'
import { initAnalytics } from './analytics'
import './index.css'

initAnalytics()

// Sin basename: las pantallas viven en /embalaje/cotizar/*, no bajo la base de
// los assets (/services-web/).
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <RequestProvider>
        <App />
      </RequestProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
