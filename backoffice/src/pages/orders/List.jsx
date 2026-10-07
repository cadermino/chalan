import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import client from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

const STATUS_ICON_PATHS = {
  list: ['M8 6h13M8 12h13M8 18h13', 'M3 6h.01M3 12h.01M3 18h.01'],
  clock: ['M12 7v5l3 2', { circle: [12, 12, 9] }],
  truck: ['M1 4h14v12H1z', 'M15 9h4l3 3v4h-7z', { circle: [5.5, 18.5, 2] }, { circle: [18.5, 18.5, 2] }],
  check: ['m8 12 3 3 5-6', { circle: [12, 12, 9] }],
  cross: ['m15 9-6 6M9 9l6 6', { circle: [12, 12, 9] }],
}

function StatusIcon({ icon, size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {STATUS_ICON_PATHS[icon].map((p, i) => (typeof p === 'string'
        ? <path key={i} d={p} />
        : <circle key={i} cx={p.circle[0]} cy={p.circle[1]} r={p.circle[2]} />))}
    </svg>
  )
}

// Cada estado tiene su color e ícono, y son los mismos en el botón de filtro
// y en la columna Estado: por eso la columna puede mostrar solo el ícono, el
// botón de arriba hace de leyenda. Las clases van escritas completas porque
// Tailwind solo genera las que encuentra literales en el código.
const STATUSES = {
  all: {
    label: 'Todas', icon: 'list',
    active: 'bg-gray-700 border-gray-700 text-white',
    idle: 'border-gray-300 text-gray-600 hover:bg-gray-50',
  },
  1: {
    label: 'Pendiente', icon: 'clock', color: 'text-amber-500',
    active: 'bg-amber-500 border-amber-500 text-white',
    idle: 'border-amber-300 text-amber-700 hover:bg-amber-50',
  },
  2: {
    label: 'En progreso', icon: 'truck', color: 'text-blue-600',
    active: 'bg-blue-600 border-blue-600 text-white',
    idle: 'border-blue-300 text-blue-700 hover:bg-blue-50',
  },
  3: {
    label: 'Completado', icon: 'check', color: 'text-green-600',
    active: 'bg-green-600 border-green-600 text-white',
    idle: 'border-green-300 text-green-700 hover:bg-green-50',
  },
  4: {
    label: 'Cancelado', icon: 'cross', color: 'text-red-500',
    active: 'bg-red-500 border-red-500 text-white',
    idle: 'border-red-300 text-red-700 hover:bg-red-50',
  },
}

const FILTERS = ['all', '1', '2', '3', '4'].map(key => ({ key, ...STATUSES[key] }))

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function QuotationsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

const money = (n) => `S/ ${Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`

// Cómo va el adelanto que el cliente le yapea a Chalán. 'unregistered' no es un
// estado de la base: es una orden ya adjudicada a la que nadie le cargó los
// pagos, que es justo la que hay que ir a resolver, así que se marca en ámbar.
function DepositCell({ deposit }) {
  if (!deposit) return <span className="text-gray-300">—</span>
  if (deposit.status === 'unregistered') {
    return (
      <span
        className="text-amber-600 font-medium"
        title="La orden tiene cotización aceptada pero no tiene pagos registrados. Se cargan desde el detalle de la orden."
      >
        ⚠ Sin registrar
      </span>
    )
  }
  if (deposit.status === 'paid') {
    return <span className="text-green-600 font-medium">✓ Cobrado {money(deposit.amount)}</span>
  }
  return <span className="text-amber-500 font-medium">○ Pendiente {money(deposit.amount)}</span>
}

// Columnas ordenables y con qué dirección arrancan al primer clic: la que
// suele interesar. Lo más reciente primero en fechas y números de orden, el
// que más ofertas tiene primero en cotizaciones, y en adelanto los que falta
// registrar arriba, que son los que hay que ir a resolver. Los vacíos cuentan
// como el valor más bajo (la API los pone primero en ascendente), así que
// "sin teléfono" o "sin fecha" se ven invirtiendo el sentido. Las de admin
// las rechaza también la API para los demás roles.
const SORTS = {
  id: { firstDir: 'desc' },
  customer: { firstDir: 'asc' },
  phone: { firstDir: 'asc', adminOnly: true },
  created: { firstDir: 'desc' },
  appointment: { firstDir: 'desc' },
  deposit: { firstDir: 'desc', adminOnly: true },
  quotations: { firstDir: 'desc', adminOnly: true },
}

// aria-sort le dice al lector de pantalla por qué columna y en qué sentido
// está ordenada la tabla; la flecha es lo mismo para el ojo.
function SortHeader({ column, label, sort, dir, onSort }) {
  const active = sort === column
  return (
    <th
      className="px-4 py-3 text-left"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 uppercase hover:text-gray-800 ${active ? 'text-gray-800' : ''}`}
      >
        {label}
        <span aria-hidden="true" className={active ? '' : 'opacity-30'}>
          {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  )
}

// Lo que vale cuando el parámetro no está en la URL. Los defaults no se
// escriben nunca, así que /orders queda limpio y solo carga lo que el usuario
// cambió de verdad — eso hace que el enlace se pueda pegar y compartir.
// El estado arranca en Pendiente: son las órdenes que piden trabajo, y "Todas"
// queda a un clic (y en la URL como ?status=all).
const DEFAULTS = { status: '1', page: 1, per_page: 25, q: '', sort: 'created', dir: 'desc', declined: '0' }
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
  const sortParam = searchParams.get('sort')
  const sort = SORTS[sortParam] && (isAdmin || !SORTS[sortParam].adminOnly)
    ? sortParam
    : DEFAULTS.sort
  const dir = ['asc', 'desc'].includes(searchParams.get('dir'))
    ? searchParams.get('dir')
    : DEFAULTS.dir
  // Solo para el transportista: las órdenes que rechazó no se le muestran,
  // salvo que pida verlas (por ejemplo, para deshacer el rechazo).
  const showDeclined = !isAdmin && searchParams.get('declined') === '1'

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

  // Otro clic en la misma columna invierte el sentido; una columna nueva
  // arranca en el suyo. Los dos parámetros se escriben siempre juntos para
  // que el que no cambió no quede heredado de la columna anterior.
  const onSort = (column) => {
    const nextDir = column === sort
      ? (dir === 'asc' ? 'desc' : 'asc')
      : SORTS[column].firstDir
    updateParams({ sort: column, dir: nextDir })
  }

  // La clave describe exactamente de qué depende esta lista, así que cada
  // combinación de filtros se cachea aparte y una respuesta vieja ya no puede
  // pisar a la nueva: si se pagina o se busca rápido, la petición anterior se
  // aborta por su `signal` y su resultado va a su propia entrada del caché, no
  // a la tabla. Con useEffect eso había que cancelarlo a mano.
  const { data, isPending, isPlaceholderData, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['orders', { status: isAdmin ? statusFilter : null, q: search, page, perPage, sort, dir, showDeclined }],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams()
      if (isAdmin) params.set('status', statusFilter)
      params.set('sort', sort)
      params.set('dir', dir)
      if (search) params.set('q', search)
      if (showDeclined) params.set('declined', '1')
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

  // Cancelación en lote. Solo las pendientes se pueden marcar: una en
  // progreso ya tiene transportista y quizá adelanto, y eso se resuelve de a
  // una desde la edición. La API aplica la misma regla por su cuenta.
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState(() => new Set())
  // Cancelar no se deshace desde acá, así que pide un segundo clic en vez de
  // un confirm() del navegador, igual que en las cotizaciones.
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)

  // La selección es de la página que se está viendo: al cambiar de filtro o
  // de página las filas marcadas dejan de estar a la vista, y cancelar algo
  // que el usuario ya no ve es justo lo que no tiene que pasar.
  useEffect(() => {
    setSelected(new Set())
    setConfirmingCancel(false)
  }, [statusFilter, search, page, perPage, sort, dir, showDeclined])

  const selectableIds = isSuperadmin
    ? orders.filter(o => o.order_status_id === 1).map(o => o.id)
    : []
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selected.has(id))
  const someSelected = selectableIds.some(id => selected.has(id))

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setConfirmingCancel(false)
  }

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(selectableIds))
    setConfirmingCancel(false)
  }

  const bulkCancel = useMutation({
    mutationFn: (orderIds) =>
      client.post('/api/orders/bulk-cancel', { order_ids: orderIds }).then(r => r.data),
    onSuccess: (result) => {
      setBulkResult({ type: 'success', ...result })
      setSelected(new Set())
      setConfirmingCancel(false)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (err) => {
      setBulkResult({
        type: 'error',
        message: err.response?.data?.message || 'No se pudieron cancelar las órdenes',
      })
      setConfirmingCancel(false)
    },
  })

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
                className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border ${
                  statusFilter === f.key ? f.active : f.idle
                }`}
              >
                <StatusIcon icon={f.icon} />
                {f.label}
              </button>
            ))}
          </div>
        ) : (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showDeclined}
              onChange={e => updateParams({ declined: e.target.checked ? '1' : '0' })}
              className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
            />
            Mostrar las que rechacé
          </label>
        )}

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

      {bulkResult && (
        <div className={`border rounded-lg p-3 mb-4 text-sm flex justify-between items-start gap-4 ${
          bulkResult.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-green-50 border-green-200 text-green-800'
        }`}>
          {bulkResult.type === 'error' ? (
            <span>{bulkResult.message}</span>
          ) : (
            <div>
              <div>
                Se cancelaron {bulkResult.cancelled.length} orden{bulkResult.cancelled.length === 1 ? '' : 'es'}
                {bulkResult.cancelled_quotations > 0 &&
                  ` y ${bulkResult.cancelled_quotations} cotización(es) activa(s)`}.
              </div>
              {bulkResult.skipped.length > 0 && (
                <div className="text-amber-700 mt-1">
                  No se cancelaron: {bulkResult.skipped.map(s => `#${s.id} (${s.reason})`).join(', ')}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setBulkResult(null)}
            className="text-xs shrink-0 opacity-70 hover:opacity-100"
          >
            Cerrar
          </button>
        </div>
      )}

      {isSuperadmin && selected.size > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-4 text-sm flex flex-wrap items-center justify-between gap-3">
          <span className="text-gray-700">
            {selected.size} orden{selected.size === 1 ? '' : 'es'} seleccionada{selected.size === 1 ? '' : 's'}
          </span>
          {confirmingCancel ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-red-700">
                ¿Cancelar {selected.size === 1 ? 'la orden' : `las ${selected.size} órdenes`}? También se cancelan sus cotizaciones activas.
              </span>
              <button
                type="button"
                disabled={bulkCancel.isPending}
                onClick={() => bulkCancel.mutate([...selected])}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50"
              >
                {bulkCancel.isPending ? 'Cancelando…' : 'Sí, cancelar'}
              </button>
              <button
                type="button"
                disabled={bulkCancel.isPending}
                onClick={() => setConfirmingCancel(false)}
                className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100"
              >
                No
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100"
              >
                Deseleccionar
              </button>
              <button
                type="button"
                onClick={() => { setBulkResult(null); setConfirmingCancel(true) }}
                className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 font-medium"
              >
                Cancelar órdenes
              </button>
            </div>
          )}
        </div>
      )}

      <div className={`bg-white rounded-xl shadow overflow-hidden transition-opacity ${
        isPlaceholderData ? 'opacity-60' : ''
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                {isSuperadmin && (
                  <th className="pl-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                      onChange={toggleAll}
                      disabled={selectableIds.length === 0}
                      title="Seleccionar las órdenes pendientes de esta página"
                      aria-label="Seleccionar las órdenes pendientes de esta página"
                      className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 disabled:opacity-40"
                    />
                  </th>
                )}
                <SortHeader column="id" label="# Orden" sort={sort} dir={dir} onSort={onSort} />
                <SortHeader column="customer" label="Cliente" sort={sort} dir={dir} onSort={onSort} />
                {isAdmin && <SortHeader column="phone" label="Teléfono" sort={sort} dir={dir} onSort={onSort} />}
                <th className="px-4 py-3 text-left">Origen</th>
                <th className="px-4 py-3 text-left">Destino</th>
                <SortHeader column="created" label="Creación" sort={sort} dir={dir} onSort={onSort} />
                <SortHeader column="appointment" label="Fecha mudanza" sort={sort} dir={dir} onSort={onSort} />
                <th className="px-4 py-3 text-center">Estado</th>
                {isAdmin
                  ? <SortHeader column="deposit" label="Adelanto" sort={sort} dir={dir} onSort={onSort} />
                  : <th className="px-4 py-3 text-left">Cotización</th>}
                {isAdmin && <SortHeader column="quotations" label="Cotizaciones" sort={sort} dir={dir} onSort={onSort} />}
                <th className="px-4 py-3 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => (
                <tr key={o.id} className={selected.has(o.id) ? 'bg-teal-50' : 'hover:bg-gray-50'}>
                  {isSuperadmin && (
                    <td className="pl-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(o.id)}
                        onChange={() => toggleOne(o.id)}
                        disabled={o.order_status_id !== 1}
                        title={o.order_status_id === 1
                          ? `Seleccionar la orden #${o.id}`
                          : 'Solo se pueden cancelar en lote las órdenes pendientes'}
                        aria-label={`Seleccionar la orden #${o.id}`}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 disabled:opacity-30"
                      />
                    </td>
                  )}
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
                  <td className="px-4 py-3 text-center">
                    {STATUSES[o.order_status_id] ? (
                      // El title da el nombre al pasar el mouse; el texto
                      // sr-only es lo que anuncia el lector de pantalla.
                      <span
                        className={`inline-flex ${STATUSES[o.order_status_id].color}`}
                        title={STATUSES[o.order_status_id].label}
                      >
                        <StatusIcon icon={STATUSES[o.order_status_id].icon} size={18} />
                        <span className="sr-only">{STATUSES[o.order_status_id].label}</span>
                      </span>
                    ) : o.order_status_id}
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin
                      ? <DepositCell deposit={o.deposit} />
                      : o.declined
                        ? <span className="text-gray-400 font-medium">Rechazada</span>
                        : (o.has_quotation
                          ? <span className="text-green-600 font-medium">Enviada</span>
                          : <span className="text-amber-500 font-medium">Pendiente</span>)}
                  </td>
                  {isAdmin && (
                    <td className={`px-4 py-3 ${o.quotation_count ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                      {o.quotation_count ?? 0}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {/* El title da el tooltip nativo del navegador; el
                        aria-label es lo que lee un lector de pantalla, que no
                        siempre anuncia el title. */}
                    <div className="flex gap-1">
                      <Link
                        to={`/orders/${o.id}`}
                        title={`Ver el detalle de la orden #${o.id}`}
                        aria-label={`Ver el detalle de la orden #${o.id}`}
                        className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50"
                      >
                        <EyeIcon />
                      </Link>
                      {isAdmin && (
                        <Link
                          to={`/orders/${o.id}/quotations`}
                          title={`Ver las cotizaciones de la orden #${o.id}`}
                          aria-label={`Ver las cotizaciones de la orden #${o.id}`}
                          className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50"
                        >
                          <QuotationsIcon />
                        </Link>
                      )}
                      {isSuperadmin && (
                        <Link
                          to={`/orders/${o.id}/edit`}
                          title={`Editar la orden #${o.id}`}
                          aria-label={`Editar la orden #${o.id}`}
                          className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50"
                        >
                          <PencilIcon />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={(isAdmin ? 11 : 9) + (isSuperadmin ? 1 : 0)} className="px-4 py-8 text-center text-gray-400">
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
