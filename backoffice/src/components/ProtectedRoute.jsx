import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCompanyServices } from '../hooks/useCompanyServices'

// `requiresMoves`: la pantalla es de mudanzas (órdenes, vehículos). Una empresa
// que solo embala o arma vuelve al inicio; admins y agentes pasan siempre.
export default function ProtectedRoute({ children, allowedRoles, requiresMoves = false }) {
  const { user } = useAuth()
  const { ready, doesMoves } = useCompanyServices()

  if (!user) return <Navigate to="/login" replace />

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  if (requiresMoves) {
    if (!ready) return <p className="text-gray-500 p-8">Cargando...</p>
    if (!doesMoves) return <Navigate to="/" replace />
  }

  return children
}
