import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { RequestProvider } from './context/RequestContext'
import { initAnalytics, initClarity, initInspectlet, tagSession } from './analytics'
import { COPY, SERVICE } from './config'
import './index.css'

// El index.html es uno solo para todos los formularios.
document.title = COPY.title
initAnalytics()
initClarity()
initInspectlet()
tagSession('service', SERVICE)

// Sin basename: las pantallas viven en /embalaje/cotizar/* y /armado/cotizar/*, no bajo la base de
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
