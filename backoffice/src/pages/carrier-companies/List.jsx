import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import { matchesSearch, offersMoves, sortCompanies } from '../../lib/companyList'

// Encabezado que ordena al hacer clic. aria-sort le dice a un lector de pantalla cuál columna
// manda; la flecha, a quien mira.
function SortableTh({ label, column, sort, onSort }) {
  const active = sort.key === column
  return (
    <th className="px-4 py-3 text-left" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 uppercase ${active ? 'text-gray-900' : 'hover:text-gray-700'}`}
      >
        {label}
        <span aria-hidden="true" className={active ? '' : 'opacity-30'}>{active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  )
}

export default function CarrierCompaniesList() {
  const { user } = useAuth()
  const [companies, setCompanies] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })

  const load = () => client.get('/api/carrier-companies')
    .then(({ data }) => setCompanies(data.carrier_companies))
    .finally(() => setLoaded(true))

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

  // Primer clic en una columna: ascendente; segundo: descendente.
  const handleSort = (key) =>
    setSort((current) => (current.key === key
      ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' }))

  const visible = useMemo(
    () => sortCompanies(companies.filter((c) => matchesSearch(c, search)), sort.key, sort.dir),
    [companies, search, sort],
  )
  const searching = search.trim() !== ''

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

      {companies.length > 1 && (
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={canCreate ? 'Buscar por nombre, ID, email, teléfono, usuario o servicio…' : 'Buscar…'}
              aria-label="Buscar empresas"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          {searching && (
            <button type="button" onClick={() => setSearch('')} className="text-sm text-gray-500 hover:text-gray-700">
              Limpiar
            </button>
          )}
          <span className="text-sm text-gray-400 whitespace-nowrap" aria-live="polite">
            {searching ? `${visible.length} de ${companies.length}` : `${companies.length} empresas`}
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <SortableTh label="ID" column="id" sort={sort} onSort={handleSort} />
              <SortableTh label="Nombre" column="name" sort={sort} onSort={handleSort} />
              {canCreate && <th className="px-4 py-3 text-left">Usuario</th>}
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Teléfono</th>
              <th className="px-4 py-3 text-left">Servicios</th>
              <SortableTh label="Estado" column="status" sort={sort} onSort={handleSort} />
              <th className="px-4 py-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-xs text-gray-400">{c.id}</td>
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
                  <div className="flex flex-wrap gap-1">
                    {offersMoves(c) && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">Mudanza</span>
                    )}
                    {(c.service_types || []).map((t) => (
                      <span key={t.id} className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-800">{t.name}</span>
                    ))}
                    {!offersMoves(c) && !(c.service_types || []).length && <span className="text-gray-400">—</span>}
                  </div>
                </td>
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
            {loaded && visible.length === 0 && (
              <tr>
                <td colSpan={canCreate ? 8 : 7} className="px-4 py-8 text-center text-gray-400">
                  {searching ? `Ninguna empresa coincide con «${search.trim()}»` : 'Sin empresas'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
