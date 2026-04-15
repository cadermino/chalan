import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'
import toast from 'react-hot-toast'

const SIZE_LABEL = { small: 'Pequeño', medium: 'Mediano', large: 'Grande' }

export default function VehiclesAdminList() {
  const [vehicles, setVehicles] = useState([])

  const load = () => {
    client.get('/api/vehicles').then(({ data }) => setVehicles(data.vehicles))
  }

  useEffect(() => { load() }, [])

  const toggle = async (v) => {
    try {
      await client.put(`/api/carrier-companies/${v.carrier_company_id}/vehicles/${v.id}`, { active: !v.active })
      toast.success(v.active ? 'Vehículo desactivado' : 'Vehículo activado')
      load()
    } catch {
      toast.error('Error al actualizar')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vehículos</h1>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Empresa</th>
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
                  <td className="px-4 py-3">
                    <Link
                      to={`/carrier-companies/${v.carrier_company_id}/vehicles`}
                      className="text-teal-600 hover:underline font-medium"
                    >
                      {v.company_name || '—'}
                    </Link>
                  </td>
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
                      <Link
                        to={`/carrier-companies/${v.carrier_company_id}/vehicles/${v.id}/edit`}
                        className="text-teal-600 hover:underline"
                      >
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
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Sin vehículos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
