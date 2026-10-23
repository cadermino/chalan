import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { itemsDone, useRequest } from './context/RequestContext'
import { pageView } from './analytics'
import { BASE_PATH, PATHS, SERVICE } from './config'
import AddressStep from './pages/AddressStep'
import PackingItemsStep from './pages/packing/ItemsStep'
import FurnitureItemsStep from './pages/furniture/ItemsStep'
import PaintingDetailsStep from './pages/painting/DetailsStep'
import ContactStep from './pages/ContactStep'
import Sent from './pages/Sent'
import Quotations from './pages/Quotations'

// Lo único que cambia de un servicio a otro es el segundo paso; el resto se comparte.
const ItemsStep = {
  furniture_assembly: FurnitureItemsStep,
  painting: PaintingDetailsStep,
}[SERVICE] || PackingItemsStep

// Equivalente a `requiresPreviousComplete` del router del flujo de mudanza: no se
// salta un paso cuyo anterior no está hecho (p. ej. al abrir el link a medias).
function RequireStep({ needs, children }) {
  const { draft, ready } = useRequest()
  if (!ready) return <p className="py-16 text-center text-inkSoft">Cargando…</p>
  if (needs === 'address' && !draft.publicId) return <Navigate to={PATHS.address} replace />
  if (needs === 'items' && !draft.publicId) return <Navigate to={PATHS.address} replace />
  if (needs === 'items' && !itemsDone(draft)) return <Navigate to={PATHS.items} replace />
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
        <Route path={`${PATHS.quotations}/:publicId`} element={<Quotations />} />
        <Route path="*" element={<Navigate to={PATHS.address} replace />} />
      </Route>
    </Routes>
  )
}
