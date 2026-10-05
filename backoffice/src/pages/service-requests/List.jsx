import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'
import { formatTimestamp } from '../../components/ServiceRequestView'

const TABS = [
  { status: 'submitted', label: 'Enviadas' },
  { status: 'draft', label: 'Incompletas' },
  { status: 'cancelled', label: 'Canceladas' },
]

function shortDay(iso) {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('es-PE', {
    timeZone: 'UTC', day: '2-digit', month: 'short',
  })
}

export default function ServiceRequestsList() {
  const [status, setStatus] = useState('submitted')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    client.get('/api/service-requests', { params: { status } })
      .then(({ data }) => setRows(data.service_requests))
      .finally(() => setLoading(false))
  }, [status])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Embalajes</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{loading ? '' : `${rows.length} solicitudes`}</span>
          <Link
            to="/service-requests/new"
            className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium"
          >
            + Nueva solicitud
          </Link>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.status}
            type="button"
            onClick={() => setStatus(tab.status)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              status === tab.status ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {status === 'draft' && (
        <p className="mb-4 text-sm text-gray-500">
          Clientes que empezaron el formulario y no lo terminaron: aún no se avisó a ningún transportista.
        </p>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Servicio</th>
                <th className="px-4 py-3 text-left">Fecha deseada</th>
                <th className="px-4 py-3 text-left">Distrito</th>
                <th className="px-4 py-3 text-left">Cosas</th>
                <th className="px-4 py-3 text-left">Fotos/videos</th>
                <th className="px-4 py-3 text-left">Avisados</th>
                <th className="px-4 py-3 text-left">{status === 'draft' ? 'Creada' : 'Enviada'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!loading && rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/service-requests/${r.id}`} className="font-medium text-teal-600 hover:underline">#{r.id}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.service_type?.name}</td>
                  <td className="px-4 py-3 text-gray-700">{shortDay(r.preferred_date)}</td>
                  <td className="px-4 py-3 text-gray-700">{r.neighborhood || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.items_count}</td>
                  <td className="px-4 py-3 text-gray-500">{r.media_count}</td>
                  <td className="px-4 py-3 text-gray-500">{r.notified_count}</td>
                  <td className="px-4 py-3 text-gray-400">{formatTimestamp(status === 'draft' ? r.created_date : r.submitted_at)}</td>
                </tr>
              ))}
              {loading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Cargando...</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No hay solicitudes</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
