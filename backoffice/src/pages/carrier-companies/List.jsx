import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function CarrierCompaniesList() {
  const { user } = useAuth()
  const [companies, setCompanies] = useState([])

  const load = () => client.get('/api/carrier-companies').then(({ data }) => setCompanies(data.carrier_companies))

  useEffect(() => { load() }, [])

  const toggle = async (c) => {
    try {
      await client.put(`/api/carrier-companies/${c.id}`, { active: !c.active })
      toast.success(c.active ? 'Empresa desactivada' : 'Empresa activada')
      load()
    } catch {
      toast.error('Error al actualizar')
    }
  }

  const canCreate = user?.role === 'superadmin' || user?.role === 'admin'
  // Solo el superadmin entra a /users/:id/edit, así que para los demás el
  // usuario se muestra como texto: un link a una pantalla que les va a
  // rebotar es peor que ninguno.
  const canOpenUser = user?.role === 'superadmin'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Empresas transportistas</h1>
        {canCreate && (
          <Link
            to="/carrier-companies/new"
            className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Nueva empresa
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              {canCreate && <th className="px-4 py-3 text-left">Usuario</th>}
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Teléfono</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {companies.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                {canCreate && (
                  <td className="px-4 py-3 text-gray-600">
                    {c.users?.length
                      ? c.users.map((u) => (
                          <div key={u.id} className="leading-tight mb-1 last:mb-0">
                            {canOpenUser ? (
                              <Link to={`/users/${u.id}/edit`} className="text-teal-600 hover:underline">
                                {u.name || u.email}
                              </Link>
                            ) : (
                              <span>{u.name || u.email}</span>
                            )}
                            {u.name && <div className="text-xs text-gray-400">{u.email}</div>}
                            {!u.active && (
                              <div className="text-xs text-amber-600" title="La cuenta se registró desde la landing y todavía no fue aprobada">
                                Pendiente de aprobación
                              </div>
                            )}
                          </div>
                        ))
                      : <span className="text-gray-400">Sin usuario</span>}
                  </td>
                )}
                <td className="px-4 py-3 text-gray-500">{c.email || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{c.phone || '—'}</td>
                <td className="px-4 py-3">
                  {c.active
                    ? <span className="text-green-600 font-medium">Activa</span>
                    : <span className="text-gray-400">Inactiva</span>}
                  {!c.country_id && (
                    <div className="text-xs text-red-500 mt-0.5" title="Sin país asignado: no recibe notificaciones de pedidos">
                      ⚠ Sin país — no recibe pedidos
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <Link to={`/carrier-companies/${c.id}/edit`} className="text-teal-600 hover:underline">
                      Editar
                    </Link>
                    <Link to={`/carrier-companies/${c.id}/vehicles`} className="text-indigo-600 hover:underline">
                      Vehículos
                    </Link>
                    {canCreate && (
                      <button onClick={() => toggle(c)} className="text-gray-500 hover:underline">
                        {c.active ? 'Desactivar' : 'Activar'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr><td colSpan={canCreate ? 6 : 5} className="px-4 py-8 text-center text-gray-400">Sin empresas</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
