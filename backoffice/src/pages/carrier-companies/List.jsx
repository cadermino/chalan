import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import client from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import {
  filterCompanies, hasActiveFilters, isPendingApproval, offersMoves, parseListState,
  serializeListState, serviceOptions, sortCompanies,
} from '../../lib/companyList'

// Encabezado que ordena al hacer clic. aria-sort le dice a un lector de pantalla cuál columna
// manda; la flecha, a quien mira.
function SortableTh({ label, column, sort, onSort }) {
  const active = sort.sort === column
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

const STATUS_LABELS = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'Activas' },
  { value: 'inactive', label: 'Inactivas' },
]

export default function CarrierCompaniesList() {
  const { user } = useAuth()
  const [companies, setCompanies] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [serviceTypes, setServiceTypes] = useState([]) // catálogo, para marcar servicios desde la lista
  // Qué empresa tiene abierto el editor de servicios, y cuál se está guardando.
  const [editingId, setEditingId] = useState(null)
  const [savingId, setSavingId] = useState(null)

  // Búsqueda, orden y filtros viven en la URL: sobreviven a recargar y a volver desde "Editar".
  const [params, setParams] = useSearchParams()
  const state = useMemo(() => parseListState(params), [params])
  // replace: teclear en el buscador no llena el historial de entradas.
  const update = (patch) => setParams(serializeListState({ ...state, ...patch }), { replace: true })

  const canCreate = user?.role === 'superadmin' || user?.role === 'admin'
  // Solo el superadmin entra a /users/:id/edit, así que para los demás el
  // usuario se muestra como texto: un link a una pantalla que les va a
  // rebotar es peor que ninguno.
  const canOpenUser = user?.role === 'superadmin'

  const load = () => client.get('/api/carrier-companies')
    .then(({ data }) => setCompanies(data.carrier_companies))
    .finally(() => setLoaded(true))

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (canCreate) client.get('/api/service-types').then(({ data }) => setServiceTypes(data.service_types))
  }, [canCreate])

  const toggle = async (c) => {
    try {
      await client.put(`/api/carrier-companies/${c.id}`, { active: !c.active })
      toast.success(c.active ? 'Empresa desactivada' : 'Empresa activada')
      load()
    } catch {
      toast.error('Error al actualizar')
    }
  }

  // Marca o desmarca un servicio y guarda al instante. El API reemplaza la lista entera, así
  // que se manda la lista completa con el cambio aplicado.
  const toggleService = async (company, serviceTypeId) => {
    const current = (company.service_types || []).map((t) => t.id)
    const next = current.includes(serviceTypeId)
      ? current.filter((id) => id !== serviceTypeId)
      : [...current, serviceTypeId]
    setSavingId(company.id)
    try {
      await client.put(`/api/carrier-companies/${company.id}`, { service_type_ids: next })
      toast.success('Servicios actualizados')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudieron actualizar los servicios')
    } finally {
      setSavingId(null)
    }
  }

  const options = useMemo(() => serviceOptions(companies), [companies])
  // Un servicio de la URL que ya no existe (un link viejo) no filtra: mejor ver todo que una lista vacía.
  const service = options.some((o) => o.code === state.service) ? state.service : ''
  const pendingCount = useMemo(() => companies.filter(isPendingApproval).length, [companies])

  const visible = useMemo(
    () => sortCompanies(
      filterCompanies(companies, { ...state, service }, editingId),
      state.sort,
      state.dir,
    ),
    [companies, state, service, editingId],
  )

  // Primer clic en una columna: ascendente; segundo: descendente.
  const handleSort = (key) =>
    update(state.sort === key ? { dir: state.dir === 'asc' ? 'desc' : 'asc' } : { sort: key, dir: 'asc' })

  const filtering = hasActiveFilters({ ...state, service })
  const clearAll = () => update({ q: '', status: 'all', service: '', pending: false })
  const columns = canCreate ? 8 : 7

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
        <div className="mb-4 space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="search"
              value={state.q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder={canCreate ? 'Buscar por nombre, ID, email, teléfono, usuario o servicio…' : 'Buscar…'}
              aria-label="Buscar empresas"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            {filtering && (
              <button type="button" onClick={clearAll} className="text-sm text-gray-500 hover:text-gray-700 whitespace-nowrap">
                Limpiar filtros
              </button>
            )}
            <span className="text-sm text-gray-400 whitespace-nowrap" aria-live="polite">
              {filtering ? `${visible.length} de ${companies.length}` : `${companies.length} empresas`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5" role="group" aria-label="Filtrar por estado">
              {STATUS_LABELS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={state.status === s.value}
                  onClick={() => update({ status: s.value })}
                  className={`rounded-md px-3 py-1 text-sm ${
                    state.status === s.value ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <select
              value={service}
              onChange={(e) => update({ service: e.target.value })}
              aria-label="Filtrar por servicio"
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Todos los servicios</option>
              {options.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
            </select>

            {canCreate && (pendingCount > 0 || state.pending) && (
              <button
                type="button"
                aria-pressed={state.pending}
                onClick={() => update({ pending: !state.pending })}
                title="Empresas con una cuenta registrada desde la landing que todavía no fue aprobada"
                className={`rounded-full border px-3 py-1 text-sm ${
                  state.pending
                    ? 'border-amber-500 bg-amber-500 text-white'
                    : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                Pendientes de aprobación ({pendingCount})
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <SortableTh label="ID" column="id" sort={state} onSort={handleSort} />
              <SortableTh label="Nombre" column="name" sort={state} onSort={handleSort} />
              {canCreate && <th className="px-4 py-3 text-left">Usuario</th>}
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Teléfono</th>
              <th className="px-4 py-3 text-left">Servicios</th>
              <SortableTh label="Estado" column="status" sort={state} onSort={handleSort} />
              <th className="px-4 py-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.map((c) => {
              const editing = editingId === c.id
              const offered = (c.service_types || []).map((t) => t.id)
              return (
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
                    {editing ? (
                      <div className="space-y-1">
                        {serviceTypes.map((t) => (
                          <label key={t.id} className="flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={offered.includes(t.id)}
                              disabled={savingId === c.id}
                              onChange={() => toggleService(c, t.id)}
                              className="h-4 w-4 accent-teal-600"
                            />
                            {t.name}
                          </label>
                        ))}
                        <p className="text-xs text-gray-400">La mudanza la reciben todas las empresas activas con país.</p>
                        <button type="button" onClick={() => setEditingId(null)} className="text-xs text-teal-600 hover:underline">
                          Listo
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {offersMoves(c) && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">Mudanza</span>
                        )}
                        {(c.service_types || []).map((t) => (
                          <span key={t.id} className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-800">{t.name}</span>
                        ))}
                        {!offersMoves(c) && !(c.service_types || []).length && <span className="text-gray-400">—</span>}
                        {canCreate && serviceTypes.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setEditingId(c.id)}
                            aria-label={`Editar servicios de ${c.name}`}
                            title="Editar servicios"
                            className="ml-1 text-xs text-gray-400 hover:text-teal-600"
                          >
                            ✎
                          </button>
                        )}
                      </div>
                    )}
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
              )
            })}
            {loaded && visible.length === 0 && (
              <tr>
                <td colSpan={columns} className="px-4 py-8 text-center text-gray-400">
                  {filtering
                    ? (state.q.trim() ? `Ninguna empresa coincide con «${state.q.trim()}» y los filtros elegidos` : 'Ninguna empresa coincide con los filtros elegidos')
                    : 'Sin empresas'}
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
