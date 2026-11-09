import { NavLink, Link, useNavigate, useMatch } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { roleLabel } from '../lib/roles'
import { useCompanyServices } from '../hooks/useCompanyServices'
import { MOVING_CODE } from '../lib/companyList'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '🏠', roles: ['superadmin', 'admin', 'carrier_company'] },
  // needsMoves: solo para empresas que hacen mudanzas (admins siempre lo ven).
  { to: '/orders', label: 'Órdenes', icon: '📦', roles: ['superadmin', 'admin', 'carrier_company'], needsMoves: true },
  { to: '/referred-orders', label: 'Órdenes referidas', icon: '🏘️', roles: ['real_estate_agent'] },
  { to: '/admin-referred-orders', label: 'Órdenes referidas', icon: '🏘️', roles: ['superadmin', 'admin'] },
  { to: '/service-requests', label: 'Servicios', icon: '🧰', roles: ['superadmin', 'admin'] },
  // needsServices: la empresa hace algún servicio además de mudanzas (embalaje, armado…).
  { to: '/my-service-requests', label: 'Servicios', icon: '🧰', roles: ['carrier_company'], needsServices: true },
  { to: '/carrier-companies', label: 'Empresas', icon: '🏢', roles: ['superadmin', 'admin', 'carrier_company'] },
  { to: '/customers', label: 'Clientes', icon: '🧑‍💼', roles: ['superadmin', 'admin'] },
  { to: '/whatsapp', label: 'WhatsApp', icon: '💬', roles: ['superadmin', 'admin'] },
  { to: '/users', label: 'Usuarios', icon: '👥', roles: ['superadmin'] },
]

export default function Sidebar({ onClose }) {
  const { user, logout } = useAuth()
  const { ready, doesMoves, services } = useCompanyServices()
  // Mientras no se sabe qué hace la empresa no se muestra lo de mudanzas: es
  // preferible que aparezca un instante tarde a que una empresa que solo arma
  // muebles lo vea parpadear.
  const showMoves = ready && doesMoves
  const showServices = ready && services.some((t) => t.code !== MOVING_CODE)
  const navigate = useNavigate()
  const handleClose = onClose ?? (() => {})

  // Detect if user is browsing inside a specific carrier company
  const companyMatch = useMatch('/carrier-companies/:companyId/*')
  const companyId = user?.role === 'carrier_company'
    ? user.carrier_company_id
    : companyMatch?.params?.companyId

  const handleLogout = () => {
    logout()
    navigate('/login')
  }


  return (
    <aside className="flex flex-col w-60 h-full bg-gray-900 text-white">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-700">
        <span className="text-xl font-bold text-teal-400">Chalán</span>
        <p className="text-xs text-gray-400 mt-0.5">Backoffice</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems
          .filter((item) => item.roles.includes(user?.role) && (!item.needsMoves || showMoves)
            && (!item.needsServices || showServices))
          .map((item) => (
            <div key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                onClick={handleClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-teal-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`
                }
              >
                <span>{item.icon}</span>
                {item.label}
              </NavLink>

              {/* Mis órdenes submenu under Órdenes — only for carrier_company */}
              {item.to === '/orders' && user?.role === 'carrier_company' && (
                <NavLink
                  to="/orders/my-orders"
                  onClick={handleClose}
                  className={({ isActive }) =>
                    `flex items-center gap-2 ml-6 pl-3 pr-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-teal-700 text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    }`
                  }
                >
                  <span>✅</span>
                  Mis órdenes
                </NavLink>
              )}

              {/* Vehicles submenu under Empresas */}
              {item.to === '/carrier-companies' && showMoves && (
                <NavLink
                  to={
                    user?.role === 'carrier_company'
                      ? `/carrier-companies/${companyId}/vehicles`
                      : '/vehicles'
                  }
                  onClick={handleClose}
                  className={({ isActive }) =>
                    `flex items-center gap-2 ml-6 pl-3 pr-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-teal-700 text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    }`
                  }
                >
                  <span>🚚</span>
                  Vehículos
                </NavLink>
              )}

              {/* Tarifas y disponibilidad de la empresa: la propia, o la que el admin está viendo. */}
              {item.to === '/carrier-companies' && showMoves && companyId && [
                { to: `/carrier-companies/${companyId}/rates`, icon: '💲', label: 'Tarifas' },
                { to: `/carrier-companies/${companyId}/availability`, icon: '📅', label: 'Disponibilidad' },
              ].map((sub) => (
                <NavLink
                  key={sub.to}
                  to={sub.to}
                  onClick={handleClose}
                  className={({ isActive }) =>
                    `flex items-center gap-2 ml-6 pl-3 pr-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-teal-700 text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    }`
                  }
                >
                  <span>{sub.icon}</span>
                  {sub.label}
                </NavLink>
              ))}
            </div>
          ))}
      </nav>

      {/* User */}
      <div className="shrink-0 px-4 py-4 border-t border-gray-700">
        <p className="text-xs text-gray-400">{roleLabel(user?.role)}</p>
        <p className="text-sm text-white truncate">{user?.email}</p>
        <div className="flex gap-3 mt-2">
          <Link
            to="/profile"
            onClick={handleClose}
            className="text-xs text-teal-400 hover:text-teal-300"
          >
            Editar perfil
          </Link>
          <button
            onClick={handleLogout}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </aside>
  )
}
