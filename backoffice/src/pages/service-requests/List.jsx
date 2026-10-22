import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'
import CopyButton from '../../components/CopyButton'
import StatusIcon from '../../components/StatusIcon'
import { formatMoney, formatTimestamp } from '../../components/ServiceRequestView'

// Los mismos estados y filtros que la lista de órdenes: cada estado tiene su
// color e ícono, en el botón de filtro y en la columna Estado. Las clases van
// completas porque Tailwind solo genera las que encuentra literales en el código.
// Un borrador (el cliente no terminó el formulario) es un pendiente sin enviar.
const STATUSES = {
  all: {
    label: 'Todos', icon: 'list',
    active: 'bg-gray-700 border-gray-700 text-white',
    idle: 'border-gray-300 text-gray-600 hover:bg-gray-50',
  },
  pending: {
    label: 'Pendiente', icon: 'clock', color: 'text-amber-500',
    active: 'bg-amber-500 border-amber-500 text-white',
    idle: 'border-amber-300 text-amber-700 hover:bg-amber-50',
  },
  in_progress: {
    label: 'En progreso', icon: 'truck', color: 'text-blue-600',
    active: 'bg-blue-600 border-blue-600 text-white',
    idle: 'border-blue-300 text-blue-700 hover:bg-blue-50',
  },
  completed: {
    label: 'Completado', icon: 'check', color: 'text-green-600',
    active: 'bg-green-600 border-green-600 text-white',
    idle: 'border-green-300 text-green-700 hover:bg-green-50',
  },
  cancelled: {
    label: 'Cancelado', icon: 'cross', color: 'text-red-500',
    active: 'bg-red-500 border-red-500 text-white',
    idle: 'border-red-300 text-red-700 hover:bg-red-50',
  },
}
const FILTERS = ['all', 'pending', 'in_progress', 'completed', 'cancelled'].map((key) => ({ key, ...STATUSES[key] }))

function shortDay(iso) {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('es-PE', {
    timeZone: 'UTC', day: '2-digit', month: 'short',
  })
}

// La reserva que el cliente le yapea a Chalán, como el Adelanto de las órdenes.
// 'none': se eligió sin que el cliente informara su yapeo (la eligió un admin).
function DepositCell({ deposit }) {
  if (!deposit) return <span className="text-gray-300">—</span>
  if (deposit.status === 'none') {
    return (
      <span className="whitespace-nowrap text-orange-500" title="Nadie informó el yapeo de la reserva: regístralo en el detalle">
        Por registrar
      </span>
    )
  }
  if (deposit.status === 'paid') {
    return <span className="whitespace-nowrap font-medium text-green-600">✓ Cobrado {formatMoney(deposit.amount)}</span>
  }
  return (
    <span className="whitespace-nowrap font-medium text-amber-500" title="El cliente informó su yapeo: verifícalo en el detalle">
      ○ Por verificar {formatMoney(deposit.amount)}
    </span>
  )
}

// Solo las que no tienen una cotización elegida: una elegida ya tiene
// transportista y quizá una reserva yapeada, y se cancela de a una desde el
// detalle. La API aplica la misma regla por su cuenta.
const canBulkCancel = (r) => r.status !== 'cancelled' && !r.deposit

export default function ServiceRequestsList() {
  const [status, setStatus] = useState('pending')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(() => new Set())
  // Cancelar no se deshace desde acá: pide un segundo clic, como en órdenes.
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)

  const load = () => {
    setLoading(true)
    return client.get('/api/service-requests', { params: status === 'all' ? {} : { status } })
      .then(({ data }) => setRows(data.service_requests))
      .finally(() => setLoading(false))
  }

  // La selección es de lo que se está viendo: al cambiar de filtro las filas
  // marcadas dejan de estar a la vista, y no se cancela lo que no se ve.
  useEffect(() => {
    setSelected(new Set())
    setConfirmingCancel(false)
    load()
  }, [status])

  const selectableIds = rows.filter(canBulkCancel).map((r) => r.id)
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))
  const someSelected = selectableIds.some((id) => selected.has(id))

  const toggleOne = (id) => {
    setSelected((prev) => {
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

  const bulkCancel = async () => {
    setCancelling(true)
    try {
      const { data } = await client.post('/api/service-requests/bulk-cancel', { service_request_ids: [...selected] })
      setBulkResult({ type: 'success', ...data })
      setSelected(new Set())
      await load()
    } catch (err) {
      setBulkResult({ type: 'error', message: err.response?.data?.message || 'No se pudieron cancelar los servicios' })
    } finally {
      setConfirmingCancel(false)
      setCancelling(false)
    }
  }

  const columns = 13

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Servicios</h1>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-gray-400 sm:inline">{loading ? '' : `${rows.length} servicios`}</span>
          <Link
            to="/service-requests/new"
            className="whitespace-nowrap rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            + Nuevo servicio
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatus(f.key)}
            aria-pressed={status === f.key}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${status === f.key ? f.active : f.idle}`}
          >
            <StatusIcon icon={f.icon} />
            {f.label}
          </button>
        ))}
      </div>

      {bulkResult && (
        <div className={`mb-4 flex items-start justify-between gap-4 rounded-lg border p-3 text-sm ${
          bulkResult.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'
        }`}>
          {bulkResult.type === 'error' ? (
            <span>{bulkResult.message}</span>
          ) : (
            <div>
              <div>{bulkResult.cancelled.length === 1 ? 'Se canceló 1 servicio' : `Se cancelaron ${bulkResult.cancelled.length} servicios`}.</div>
              {bulkResult.skipped.length > 0 && (
                <div className="mt-1 text-amber-700">
                  No se cancelaron: {bulkResult.skipped.map((s) => `#${s.id} (${s.reason})`).join(', ')}
                </div>
              )}
            </div>
          )}
          <button type="button" onClick={() => setBulkResult(null)} className="shrink-0 text-xs opacity-70 hover:opacity-100">
            Cerrar
          </button>
        </div>
      )}

      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
          <span className="text-gray-700">
            {selected.size} servicio{selected.size === 1 ? '' : 's'} seleccionado{selected.size === 1 ? '' : 's'}
          </span>
          {confirmingCancel ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-red-700">
                ¿Cancelar {selected.size === 1 ? 'el servicio' : `los ${selected.size} servicios`}? El cliente ya no podrá elegir cotizaciones.
              </span>
              <button
                type="button"
                disabled={cancelling}
                onClick={bulkCancel}
                className="rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {cancelling ? 'Cancelando…' : 'Sí, cancelar'}
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={() => setConfirmingCancel(false)}
                className="rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-100"
              >
                No
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSelected(new Set())} className="rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-100">
                Deseleccionar
              </button>
              <button
                type="button"
                onClick={() => { setBulkResult(null); setConfirmingCancel(true) }}
                className="rounded-lg border border-red-300 px-3 py-1.5 font-medium text-red-700 hover:bg-red-50"
              >
                Cancelar servicios
              </button>
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow">
        {/* relative: los sr-only de las celdas quedan recortados por este scroll (ver orders/List.jsx). */}
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="w-8 py-3 pl-4">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
                    onChange={toggleAll}
                    disabled={selectableIds.length === 0}
                    title="Seleccionar los servicios que se pueden cancelar"
                    aria-label="Seleccionar los servicios que se pueden cancelar"
                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 disabled:opacity-40"
                  />
                </th>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Servicio</th>
                <th className="px-4 py-3 text-left">WhatsApp</th>
                <th className="px-4 py-3 text-left">Fecha deseada</th>
                <th className="px-4 py-3 text-left">Distrito</th>
                <th className="px-4 py-3 text-left">Cosas</th>
                <th className="px-4 py-3 text-left">Avisados</th>
                <th className="px-4 py-3 text-left">Cotizaciones</th>
                <th className="px-4 py-3 text-left">Desde</th>
                <th className="px-4 py-3 text-left">Adelanto</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-left">Enviado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!loading && rows.map((r) => {
                const state = STATUSES[r.status]
                const selectable = canBulkCancel(r)
                return (
                  <tr key={r.id} className={selected.has(r.id) ? 'bg-teal-50' : 'hover:bg-gray-50'}>
                    <td className="py-3 pl-4">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleOne(r.id)}
                        disabled={!selectable}
                        title={selectable
                          ? `Seleccionar el servicio #${r.id}`
                          : r.status === 'cancelled'
                            ? 'Ya está cancelado'
                            : 'Tiene una cotización elegida: se cancela desde el detalle'}
                        aria-label={`Seleccionar el servicio #${r.id}`}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 disabled:opacity-30"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/service-requests/${r.id}`} className="font-medium text-teal-600 hover:underline">#{r.id}</Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.service_type?.name}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {r.whatsapp
                        ? (
                          <span className="flex items-center gap-2">
                            <span className="text-gray-700">{r.whatsapp}</span>
                            <CopyButton text={r.whatsapp} label="Copiar" />
                          </span>
                        )
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{shortDay(r.preferred_date)}</td>
                    <td className="px-4 py-3 text-gray-700">{r.neighborhood || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{r.items_count}</td>
                    <td className="px-4 py-3 text-gray-500">{r.notified_count}</td>
                    <td className="px-4 py-3 text-gray-700">{r.quotations_count}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{formatMoney(r.min_amount)}</td>
                    <td className="px-4 py-3"><DepositCell deposit={r.deposit} /></td>
                    <td className="px-4 py-3 text-center">
                      {state ? (
                        <span className={`inline-flex ${state.color}`} title={state.label}>
                          <StatusIcon icon={state.icon} size={18} />
                          <span className="sr-only">{state.label}</span>
                        </span>
                      ) : r.status}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {r.submitted_at
                        ? formatTimestamp(r.submitted_at)
                        : <span title={`Creado ${formatTimestamp(r.created_date)}`}>Sin enviar</span>}
                    </td>
                  </tr>
                )
              })}
              {loading && (
                <tr><td colSpan={columns} className="px-4 py-8 text-center text-gray-400">Cargando...</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={columns} className="px-4 py-8 text-center text-gray-400">No hay servicios</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
