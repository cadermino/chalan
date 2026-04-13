import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '🏠', roles: ['superadmin', 'admin', 'carrier_company'] },
  { to: '/carrier-companies', label: 'Empresas', icon: '🏢', roles: ['superadmin', 'admin', 'carrier_company'] },
  { to: '/users', label: 'Usuarios', icon: '👥', roles: ['superadmin'] },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

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
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
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
          ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-700">
        <p className="text-xs text-gray-400">{roleLabel[user?.role]}</p>
        <p className="text-sm text-white truncate">{user?.email}</p>
        <button
          onClick={handleLogout}
          className="mt-2 text-xs text-red-400 hover:text-red-300"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
