import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

const ROLES = ['superadmin', 'admin', 'carrier_company']
const roleBadge = {
  superadmin: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  carrier_company: 'bg-teal-100 text-teal-800',
}

export default function UsersList() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState([])

  const load = () => {
    client.get('/api/users').then(({ data }) => setUsers(data.users))
  }

  useEffect(() => { load() }, [])

  const toggle = async (u) => {
    try {
      await client.put(`/api/users/${u.id}`, { active: !u.active })
      toast.success(u.active ? 'Usuario desactivado' : 'Usuario activado')
      load()
    } catch {
      toast.error('Error al actualizar usuario')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
        <Link
          to="/users/new"
          className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Nuevo usuario
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">DNI</th>
              <th className="px-4 py-3 text-left">Rol</th>
              <th className="px-4 py-3 text-left">Empresa</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {u.first_name || u.last_name
                    ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
                    : '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3 text-gray-500">{u.dni || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge[u.role]}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{u.carrier_company_id ?? '—'}</td>
                <td className="px-4 py-3">
                  {u.active
                    ? <span className="text-green-600 font-medium">Activo</span>
                    : <span className="text-gray-400">Inactivo</span>}
                </td>
                <td className="px-4 py-3 flex gap-3">
                  <Link to={`/users/${u.id}/edit`} className="text-teal-600 hover:underline">
                    Editar
                  </Link>
                  {u.id !== me?.id && (
                    <button onClick={() => toggle(u)} className="text-gray-500 hover:underline">
                      {u.active ? 'Desactivar' : 'Activar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Sin usuarios</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
