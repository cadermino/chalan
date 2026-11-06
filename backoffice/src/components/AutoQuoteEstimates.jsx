import { useEffect, useState } from 'react'
import client from '../api/client'
import Card from './Card'

// Lo que cada empresa habría cotizado con sus tarifas, calculado en silencio a
// los 20 minutos de avisada la orden (backoffice-api api/auto_quote.py), al lado
// de lo que cotizó de verdad. Nadie más lo ve: sirve para medir las tarifas
// antes de cotizar por las empresas.

const soles = (n) => `S/ ${Number(n).toLocaleString('es-PE')}`
const pct = (e) => `${e > 0 ? '+' : ''}${Math.round(e * 100)}%`

export default function AutoQuoteEstimates({ orderId }) {
  const [data, setData] = useState(null)
  const [showItems, setShowItems] = useState(false)

  useEffect(() => {
    client.get(`/api/orders/${orderId}/auto-quote`).then(({ data }) => setData(data)).catch(() => setData(null))
  }, [orderId])

  // Sin mirar todavía (aún no pasan 20 minutos, o es de antes de esto): nada que mostrar.
  if (!data || (!data.checked_at && data.estimates.length === 0)) return null

  const volume = data.volume
  return (
    <Card title="Con sus tarifas (en prueba)">
      <p className="text-xs text-gray-500 mb-3">
        Lo que cada empresa habría cotizado con sus tarifas, sin mostrárselo a nadie. Sirve para ver cuánto
        aciertan antes de cotizar por ellas.
      </p>

      {data.estimated_volume_m3 != null && (
        <div className="mb-3 text-sm text-gray-700">
          <span className="font-medium">~{data.estimated_volume_m3} m³</span>
          {volume?.stated ? ' (lo escribió el cliente)' : ' según la lista de cosas'}
          {volume?.items?.length > 0 && (
            <button type="button" onClick={() => setShowItems(!showItems)} className="ml-2 text-xs text-teal-600 hover:underline">
              {showItems ? 'Ocultar' : 'Ver cómo'}
            </button>
          )}
          {showItems && (
            <ul className="mt-2 space-y-0.5 text-xs text-gray-500">
              {volume.items.map((item, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>
                    {item.text}
                    <span className={item.key ? 'text-gray-400' : 'text-amber-600'}> · {item.label}</span>
                  </span>
                  <span className="whitespace-nowrap">{item.m3} m³</span>
                </li>
              ))}
              {!volume.stated && <li className="text-gray-400">+25% porque las cosas no encajan perfecto en el camión.</li>}
              {volume.unknown?.length > 0 && (
                <li className="text-amber-600">
                  Sin reconocer: {volume.unknown.join(' · ')}
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {data.skip_label && <p className="text-sm text-gray-500">No se calculó: {data.skip_label.toLowerCase()}.</p>}

      {data.estimates.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-400 text-left">
              <tr>
                <th className="py-1 pr-3 font-medium">Empresa</th>
                <th className="py-1 pr-3 font-medium text-right">Con sus tarifas</th>
                <th className="py-1 pr-3 font-medium text-right">Cotizó</th>
                <th className="py-1 font-medium text-right">Diferencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.estimates.map((e) => (
                <tr key={e.carrier_company_id}>
                  <td className="py-1.5 pr-3 text-gray-800">{e.name}</td>
                  <td className="py-1.5 pr-3 text-right whitespace-nowrap" title={e.lines?.map((l) => `${l.label}: S/ ${l.amount}`).join('\n')}>
                    {e.amount != null ? soles(e.amount) : <span className="text-xs text-gray-400">{e.skip_label}</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-right whitespace-nowrap text-gray-600">{e.quoted != null ? soles(e.quoted) : '—'}</td>
                  <td className={`py-1.5 text-right whitespace-nowrap ${
                    e.error == null ? 'text-gray-300' : Math.abs(e.error) <= 0.25 ? 'text-green-700' : 'text-red-600'
                  }`}>
                    {e.error != null ? pct(e.error) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
