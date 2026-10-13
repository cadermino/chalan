import { useQuery } from '@tanstack/react-query'
import client from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { MOVING_CODE } from '../lib/companyList'

// Qué hace la empresa del usuario logueado (mudanza, embalaje, armado), para
// mostrarle solo lo suyo: sin mudanza no hay "Órdenes" ni "Vehículos".
// Admins y agentes no tienen empresa: para ellos `doesMoves` es true y no filtra.
// Se pide una vez y se cachea; si un admin cambia los servicios, se ve al
// recargar o a los 5 minutos.
export function useCompanyServices() {
  const { user } = useAuth()
  const isCarrier = user?.role === 'carrier_company'
  const companyId = user?.carrier_company_id

  const query = useQuery({
    queryKey: ['company-services', companyId],
    queryFn: () => client.get(`/api/carrier-companies/${companyId}`)
      .then((r) => r.data.carrier_company.service_types || []),
    enabled: isCarrier && Boolean(companyId),
    staleTime: 5 * 60 * 1000,
  })

  if (!isCarrier) return { ready: true, doesMoves: true, services: [] }
  if (!companyId) return { ready: true, doesMoves: false, services: [] }
  // Si falla la consulta se muestra todo: la API corta igual lo que no le toca,
  // y es peor dejar a un transportista sin su menú de órdenes por un error de red.
  if (query.isError) return { ready: true, doesMoves: true, services: [] }
  const services = query.data || []
  return {
    ready: !query.isPending,
    doesMoves: services.some((t) => t.code === MOVING_CODE),
    services,
  }
}
