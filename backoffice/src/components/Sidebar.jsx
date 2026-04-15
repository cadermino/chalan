import { NavLink, Link, useNavigate, useMatch } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '🏠', roles: ['superadmin', 'admin', 'carrier_company'] },
  { to: '/carrier-companies', label: 'Empresas', icon: '🏢', roles: ['superadmin', 'admin', 'carrier_company'] },
  { to: '/users', label: 'Usuarios', icon: '👥', roles: ['superadmin'] },
]

export default function Sidebar({ onClose }) {
  const { user, logout } = useAuth()
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

  const roleLabel = {
    superadmin: 'Super Admin',
    admin: 'Admin',
    carrier_company: 'Empresa',
  }

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-gray-900 text-white">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-700">
        <span className="text-xl font-bold text-teal-400">Chalán</span>
        <p className="text-xs text-gray-400 mt-0.5">Backoffice</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems
          .filter((item) => item.roles.includes(user?.role))
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

              {/* Vehicles submenu under Empresas */}
              {item.to === '/carrier-companies' && (
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
            </div>
          ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-700">
        <p className="text-xs text-gray-400">{roleLabel[user?.role]}</p>
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
