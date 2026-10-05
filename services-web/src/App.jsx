import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { useRequest } from './context/RequestContext'
import { pageView } from './analytics'
import { BASE_PATH, PATHS } from './config'
import AddressStep from './pages/packing/AddressStep'
import ItemsStep from './pages/packing/ItemsStep'
import ContactStep from './pages/packing/ContactStep'
import Sent from './pages/packing/Sent'

// Equivalente a `requiresPreviousComplete` del router del flujo de mudanza: no se
// salta un paso cuyo anterior no está hecho (p. ej. al abrir el link a medias).
function RequireStep({ needs, children }) {
  const { draft, ready } = useRequest()
  if (!ready) return <p className="py-16 text-center text-inkSoft">Cargando…</p>
  if (needs === 'address' && !draft.publicId) return <Navigate to={PATHS.address} replace />
  if (needs === 'items' && !draft.publicId) return <Navigate to={PATHS.address} replace />
  if (needs === 'items' && draft.items.length === 0) return <Navigate to={PATHS.items} replace />
  return children
}

export default function App() {
  const location = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    pageView(location.pathname)
  }, [location.pathname])

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path={BASE_PATH} element={<Navigate to={PATHS.address} replace />} />
        <Route path={PATHS.address} element={<AddressStep />} />
        <Route path={PATHS.items} element={<RequireStep needs="address"><ItemsStep /></RequireStep>} />
        <Route path={PATHS.contact} element={<RequireStep needs="items"><ContactStep /></RequireStep>} />
        <Route path={PATHS.sent} element={<Sent />} />
        <Route path="*" element={<Navigate to={PATHS.address} replace />} />
      </Route>
    </Routes>
  )
}
