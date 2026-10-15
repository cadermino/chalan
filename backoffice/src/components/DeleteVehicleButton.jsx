import { useState } from 'react'
import client from '../api/client'
import toast from 'react-hot-toast'

// Lo que responde el API cuando borrar dejaría cotizaciones sin vehículo que
// mostrar (ver delete_vehicle en backoffice-api).
const BLOCKED = {
  'vehicle has quotations': 'Una cotización apunta a este vehículo. Desactívalo en vez de eliminarlo.',
  'last vehicle of a company with quotations':
    'Es el único vehículo de una empresa con cotizaciones: sin él, sus cotizaciones dejan de verse. Desactívalo en vez de eliminarlo.',
}

// Eliminar no se deshace, así que pide un segundo clic en vez de un confirm()
// del navegador, que corta la página entera. Solo admin y superadmin.
export default function DeleteVehicleButton({ vehicle, onDeleted }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const remove = async () => {
    setDeleting(true)
    try {
      await client.delete(`/api/carrier-companies/${vehicle.carrier_company_id}/vehicles/${vehicle.id}`)
      toast.success('Vehículo eliminado')
      onDeleted()
    } catch (err) {
      const message = err.response?.data?.message
      toast.error(BLOCKED[message] || 'No se pudo eliminar el vehículo', { duration: 6000 })
      setConfirming(false)
    } finally {
      setDeleting(false)
    }
  }

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="text-red-600 hover:underline">
        Eliminar
      </button>
    )
  }

  return (
    <span className="flex items-center gap-2">
      <span className="text-gray-500">¿Eliminar?</span>
      <button onClick={remove} disabled={deleting} className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50">
        {deleting ? 'Eliminando…' : 'Sí'}
      </button>
      <button onClick={() => setConfirming(false)} disabled={deleting} className="text-gray-400 hover:text-gray-600">
        No
      </button>
    </span>
  )
}
