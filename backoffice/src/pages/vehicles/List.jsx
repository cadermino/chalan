import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import client from '../../api/client'
import toast from 'react-hot-toast'

const SIZE_LABEL = { small: 'Pequeño', medium: 'Mediano', large: 'Grande' }

export default function VehiclesList() {
  const { companyId } = useParams()
  const [vehicles, setVehicles] = useState([])
  const [company, setCompany] = useState(null)

  const load = () => {
    client.get(`/api/carrier-companies/${companyId}/vehicles`).then(({ data }) => setVehicles(data.vehicles))
    client.get(`/api/carrier-companies/${companyId}`).then(({ data }) => setCompany(data.carrier_company))
  }

  useEffect(() => { load() }, [companyId])

  const toggle = async (v) => {
    try {
      await client.put(`/api/carrier-companies/${companyId}/vehicles/${v.id}`, { active: !v.active })
      toast.success(v.active ? 'Vehículo desactivado' : 'Vehículo activado')
      load()
    } catch {
      toast.error('Error al actualizar')
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Link to="/carrier-companies" className="text-teal-600 hover:underline text-sm">← Empresas</Link>
      </div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Vehículos — <span className="text-teal-600">{company?.name ?? '…'}</span>
        </h1>
        <Link
          to={`/carrier-companies/${companyId}/vehicles/new`}
          className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + Nuevo vehículo
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Marca / Modelo</th>
              <th className="px-4 py-3 text-left">Placas</th>
              <th className="px-4 py-3 text-left">Tamaño</th>
              <th className="px-4 py-3 text-right">S/km</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {vehicles.map((v) => (
              <tr key={v.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {v.brand} {v.model}
                </td>
                <td className="px-4 py-3 text-gray-500">{v.plates || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{SIZE_LABEL[v.size] || v.size}</td>
                <td className="px-4 py-3 text-right">{v.charge_per_kilometer}</td>
                <td className="px-4 py-3">
                  {v.active
                    ? <span className="text-green-600 font-medium">Activo</span>
                    : <span className="text-gray-400">Inactivo</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <Link to={`/carrier-companies/${companyId}/vehicles/${v.id}/edit`} className="text-teal-600 hover:underline">
                      Editar
                    </Link>
                    <button onClick={() => toggle(v)} className="text-gray-500 hover:underline">
                      {v.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Sin vehículos</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
