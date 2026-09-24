import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import client from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

const STATUS_LABEL = { 1: 'Pendiente', 2: 'En progreso', 3: 'Completado', 4: 'Cancelado' }

const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: '1', label: 'Pendiente' },
  { key: '2', label: 'En progreso' },
  { key: '3', label: 'Completado' },
  { key: '4', label: 'Cancelado' },
]

// Lo que vale cuando el parámetro no está en la URL. Los defaults no se
// escriben nunca, así que /orders queda limpio y solo carga lo que el usuario
// cambió de verdad — eso hace que el enlace se pueda pegar y compartir.
const DEFAULTS = { status: 'all', page: 1, per_page: 25, q: '' }
const PER_PAGE_OPTIONS = [25, 50, 100]

export default function OrdersList() {
  const { user } = useAuth()
  const isSuperadmin = user?.role === 'superadmin'
  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin'
  const [searchParams, setSearchParams] = useSearchParams()

  // La URL es la única fuente de verdad: no se duplica en estado de React,
  // que es lo que hace que recargar, compartir el enlace o usar atrás y
  // adelante del navegador funcionen sin código extra.
  const statusFilter = FILTERS.some(f => f.key === searchParams.get('status'))
    ? searchParams.get('status')
    : DEFAULTS.status
  const page = Math.max(1, Number(searchParams.get('page')) || DEFAULTS.page)
  const perPage = PER_PAGE_OPTIONS.includes(Number(searchParams.get('per_page')))
    ? Number(searchParams.get('per_page'))
    : DEFAULTS.per_page
  const search = searchParams.get('q')?.trim() || DEFAULTS.q

  // El input sí lleva estado propio: escribir no debe consultar al servidor ni
  // dejar una entrada en el historial por tecla. La búsqueda pasa a la URL al
  // enviar el formulario. El efecto lo devuelve a lo que diga la URL cuando
  // esta cambia por fuera (atrás/adelante del navegador, o "Limpiar").
  const [searchInput, setSearchInput] = useState(search)
  useEffect(() => { setSearchInput(search) }, [search])

  // Solo escribe lo que difiere del default, y conserva el resto de
  // parámetros. Cambiar un filtro vuelve a la página 1: quedarse en la 7 de un
  // resultado que ahora tiene 2 páginas deja la tabla vacía sin explicación.
  const updateParams = (changes, { resetPage = true } = {}) => {
    const next = Object.fromEntries(searchParams)
    if (resetPage && !('page' in changes)) delete next.page
    Object.assign(next, changes)
    Object.keys(DEFAULTS).forEach((key) => {
      if (next[key] === undefined || next[key] === null
          || String(next[key]) === String(DEFAULTS[key])) delete next[key]
    })
    setSearchParams(next)
  }

  // La clave describe exactamente de qué depende esta lista, así que cada
  // combinación de filtros se cachea aparte y una respuesta vieja ya no puede
  // pisar a la nueva: si se pagina o se busca rápido, la petición anterior se
  // aborta por su `signal` y su resultado va a su propia entrada del caché, no
  // a la tabla. Con useEffect eso había que cancelarlo a mano.
  const { data, isPending, isPlaceholderData, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['orders', { status: isAdmin ? statusFilter : null, q: search, page, perPage }],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams()
      if (isAdmin) params.set('status', statusFilter)
      if (search) params.set('q', search)
      params.set('page', page)
      params.set('per_page', perPage)
      return client.get(`/api/orders/pending?${params}`, { signal }).then(r => r.data)
    },
    // Mantiene la tabla anterior en pantalla mientras carga la nueva página o
    // búsqueda, en vez del parpadeo a "Cargando...". `isPlaceholderData` avisa
    // que lo que se ve todavía es lo de antes.
    placeholderData: keepPreviousData,
  })

  const orders = data?.orders ?? []
  const pagination = data?.pagination ?? null

  if (isPending) {
    return <p className="text-gray-500 p-8">Cargando...</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Órdenes</h1>
        {isSuperadmin && (
          <Link
            to="/orders/create"
            className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium"
          >
            + Crear orden
          </Link>
        )}
      </div>

      {/* Un fallo de red se veía igual que un resultado vacío: la tabla decía
          "No hay órdenes para este filtro", que era mentira. El aviso va
          arriba y la pantalla se mantiene entera — con buscador y filtros
          vivos — para que el usuario pueda volver a lo que sí tenía cargado
          en vez de quedarse frente a un cartel de error. */}
      {isError && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800 flex justify-between items-center gap-4">
          <span>
            {orders.length > 0
              ? 'No se pudo actualizar la lista; estás viendo datos anteriores.'
              : 'No se pudieron cargar las órdenes.'}
            {error?.response?.status ? ` (error ${error.response.status})` : ''}
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-amber-700 hover:text-amber-900 font-medium shrink-0"
          >
            Reintentar
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); updateParams({ q: searchInput.trim() }) }}
        className="flex gap-2 mb-4"
      >
        <input
          type="search"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder={isAdmin
            ? 'Buscar por # de orden, cliente, email o teléfono...'
            : 'Buscar por # de orden...'}
          aria-label="Buscar órdenes"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button
          type="submit"
          className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          Buscar
        </button>
        {search && (
          <button
            type="button"
            onClick={() => updateParams({ q: '' })}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
          >
            Limpiar
          </button>
        )}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {isAdmin ? (
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => updateParams({ status: f.key })}
                aria-pressed={statusFilter === f.key}
                className={`text-sm px-3 py-1.5 rounded-lg border ${
                  statusFilter === f.key
                    ? 'bg-teal-600 border-teal-600 text-white'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        ) : <span />}

        {pagination && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>
              {pagination.total} órden{pagination.total === 1 ? '' : 'es'}
              {isFetching && <span className="text-gray-400"> · actualizando…</span>}
            </span>
            <label className="flex items-center gap-1">
              <span className="sr-only">Órdenes por página</span>
              <select
                value={perPage}
                onChange={e => updateParams({ per_page: e.target.value })}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n} por página</option>)}
              </select>
            </label>
          </div>
        )}
      </div>

      <div className={`bg-white rounded-xl shadow overflow-hidden transition-opacity ${
        isPlaceholderData ? 'opacity-60' : ''
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left"># Orden</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                {isAdmin && <th className="px-4 py-3 text-left">Teléfono</th>}
                <th className="px-4 py-3 text-left">Origen</th>
                <th className="px-4 py-3 text-left">Destino</th>
                <th className="px-4 py-3 text-left">Creación</th>
                <th className="px-4 py-3 text-left">Fecha mudanza</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Cotización</th>
                <th className="px-4 py-3 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">#{o.id}</td>
                  <td className="px-4 py-3 text-gray-700">{o.customer_name || '—'}</td>
                  {isAdmin && <td className="px-4 py-3 text-gray-600">{o.customer_phone || o.lead_phone || '—'}</td>}
                  <td className="px-4 py-3 text-gray-600">
                    {o.origin ? (
                      <div>
                        <div>{[o.origin.street, o.origin.neighborhood].filter(Boolean).join(', ') || '—'}</div>
                        <div className="text-xs text-gray-400">{[o.origin.city, o.origin.state].filter(Boolean).join(', ')}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {o.destination ? (
                      <div>
                        <div>{[o.destination.street, o.destination.neighborhood].filter(Boolean).join(', ') || '—'}</div>
                        <div className="text-xs text-gray-400">{[o.destination.city, o.destination.state].filter(Boolean).join(', ')}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {o.created_date ? (
                      <div>
                        <div>{new Date(o.created_date).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}</div>
                        <div className="text-xs text-gray-400">{new Date(o.created_date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {o.appointment_date ? (
                      <div>
                        <div>{new Date(o.appointment_date).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}</div>
                        <div className="text-xs text-gray-400">{new Date(o.appointment_date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {STATUS_LABEL[o.order_status_id] || o.order_status_id}
                  </td>
                  <td className="px-4 py-3">
                    {o.has_quotation
                      ? <span className="text-green-600 font-medium">Enviada</span>
                      : <span className="text-amber-500 font-medium">Pendiente</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <Link
                        to={`/orders/${o.id}`}
                        className="text-teal-600 hover:underline"
                      >
                        Ver detalle
                      </Link>
                      {isAdmin && (
                        <Link
                          to={`/orders/${o.id}/quotations`}
                          className="text-indigo-600 hover:underline"
                        >
                          Cotizaciones
                        </Link>
                      )}
                      {isSuperadmin && (
                        <Link
                          to={`/orders/${o.id}/edit`}
                          className="text-amber-600 hover:underline"
                        >
                          Editar
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} className="px-4 py-8 text-center text-gray-400">
                    {isError
                      ? <>No se pudieron cargar las órdenes. <button type="button" onClick={() => refetch()} className="text-teal-600 hover:underline">Reintentar</button></>
                      : pagination && pagination.total > 0
                      ? <>Esta página no existe. <button type="button" onClick={() => updateParams({ page: 1 })} className="text-teal-600 hover:underline">Volver a la primera</button></>
                      : search
                        ? <>Ninguna orden coincide con «{search}». <button type="button" onClick={() => updateParams({ q: '' })} className="text-teal-600 hover:underline">Limpiar la búsqueda</button></>
                        : 'No hay órdenes para este filtro'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => updateParams({ page: page - 1 }, { resetPage: false })}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            ← Anterior
          </button>
          <span className="text-sm text-gray-500">
            Página {page} de {pagination.pages}
          </span>
          <button
            type="button"
            disabled={page >= pagination.pages}
            onClick={() => updateParams({ page: page + 1 }, { resetPage: false })}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
