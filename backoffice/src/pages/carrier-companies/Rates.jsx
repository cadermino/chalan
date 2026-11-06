import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import client from '../../api/client'
import Card from '../../components/Card'
import { useAuth } from '../../contexts/AuthContext'

// Lo que cobra la empresa por una mudanza (backoffice-api carrier_rates.py).
// En Lima el precio sigue a lo que se lleva, no a la distancia, así que es una
// base más un precio por m³; fuera de Lima se suman los km. El simulador
// muestra el total de mudanzas de ejemplo mientras se escribe: los
// transportistas piensan en totales, no en tarifas por unidad.

const FIELDS = [
  { section: 'En Lima' },
  { key: 'base_fee', label: 'Base', hint: 'Lo que cobras por salir: el camión y el conductor.' },
  { key: 'per_m3', label: 'Por m³ de carga', hint: 'Un ropero ocupa ~1.2 m³, una refrigeradora ~1 m³, una caja mediana ~0.07 m³.' },
  { key: 'per_loader', label: 'Por cargador' },
  { key: 'per_floor', label: 'Por piso sin ascensor', hint: 'Por cada piso que hay que subir o bajar a pie, en el origen y en el destino.' },
  { key: 'minimum_fare', label: 'Tarifa mínima', hint: 'Lo menos que cobras, aunque la mudanza sea chica.' },
  { section: 'Fuera de Lima' },
  { key: 'per_km_outside_lima', label: 'Por km', hint: 'Se suma a lo de arriba cuando el origen o el destino está fuera de Lima.' },
  { section: 'Fin de semana' },
  { key: 'weekend_surcharge_percent', label: 'Recargo sábado y domingo', unit: '%' },
  { section: 'Hasta dónde' },
  { key: 'max_m3', label: 'Lo más que llevas en un viaje', unit: 'm³', money: false },
  { key: 'max_km', label: 'Lo más lejos que vas', unit: 'km', money: false },
]

const SCENARIOS = [
  { label: 'Un cuarto', detail: '4 m³', move: { m3: 4 } },
  { label: 'Depa de 1 dormitorio', detail: '10 m³ · 3.er piso sin ascensor · 1 cargador', move: { m3: 10, floors: 2, loaders: 1 } },
  { label: 'Depa de 2 dormitorios', detail: '18 m³ · 2 cargadores · sábado', move: { m3: 18, loaders: 2, weekend: true } },
  { label: 'Lima → Huancayo', detail: '12 m³ · 300 km', move: { m3: 12, km: 300, outside_lima: true } },
]

const EMPTY = Object.fromEntries(FIELDS.filter((f) => f.key).map((f) => [f.key, '']))

const toForm = (rates) => Object.fromEntries(Object.keys(EMPTY).map((k) => [k, rates[k] ?? '']))
const toPayload = (form) => Object.fromEntries(
  Object.entries(form).map(([k, v]) => [k, v === '' ? null : Number(String(v).replace(',', '.'))]),
)

export default function CarrierRates() {
  const { companyId } = useParams()
  const { user } = useAuth()
  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin'
  const [company, setCompany] = useState(null)
  const [accuracy, setAccuracy] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saved, setSaved] = useState(null)
  const [autoQuote, setAutoQuote] = useState(false)
  const [simulation, setSimulation] = useState(null)
  const [open, setOpen] = useState(1)
  const [saving, setSaving] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    client.get(`/api/carrier-companies/${companyId}`).then(({ data }) => setCompany(data.carrier_company))
    client.get(`/api/carrier-companies/${companyId}/rates`).then(({ data }) => {
      setSaved(data.rates)
      setForm(toForm(data.rates))
      setAutoQuote(data.rates.auto_quote)
    })
    if (isAdmin) {
      client.get(`/api/carrier-companies/${companyId}/auto-quote-accuracy`).then(({ data }) => setAccuracy(data))
    }
  }, [companyId, isAdmin])

  // El simulador no guarda: recalcula con lo que está escrito, un momento
  // después de dejar de escribir.
  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      client.post(`/api/carrier-companies/${companyId}/rates/simulate`, {
        rates: toPayload(form),
        scenarios: SCENARIOS.map((s) => s.move),
      }).then(({ data }) => setSimulation(data)).catch(() => setSimulation(null))
    }, 300)
    return () => clearTimeout(timer.current)
  }, [companyId, form])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const complete = simulation?.complete

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await client.put(`/api/carrier-companies/${companyId}/rates`, {
        ...toPayload(form), auto_quote: autoQuote,
      })
      setSaved(data.rates)
      setAutoQuote(data.rates.auto_quote)
      toast.success('Tarifas guardadas')
    } catch (err) {
      const field = FIELDS.find((f) => f.key === err.response?.data?.field)
      toast.error(field ? `Revisa "${field.label}"` : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const authorized = saved?.auto_quote && saved.auto_quote_authorized_by

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Link to="/carrier-companies" className="text-teal-600 hover:underline text-sm">← Empresas</Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Tarifas — <span className="text-teal-600">{company?.name ?? '…'}</span>
      </h1>
      <p className="text-sm text-gray-500 mb-6 max-w-2xl">
        Con estas tarifas calculamos cuánto cobrarías por una mudanza. A la derecha ves cuánto saldrían
        algunas mudanzas de ejemplo: si un total no te suena, corrige la tarifa. Es tu precio: la comisión
        de Chalán la paga el cliente encima.
      </p>

      <form onSubmit={save} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] items-start">
        <div className="space-y-6">
          <Card>
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((f) => f.section ? (
                <p key={f.section} className="sm:col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2 first:pt-0">
                  {f.section}
                </p>
              ) : (
                <div key={f.key}>
                  <label htmlFor={f.key} className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <div className="relative">
                    {f.money !== false && !f.unit && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">S/</span>
                    )}
                    <input
                      id={f.key}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={form[f.key]}
                      onChange={set(f.key)}
                      className={`input ${f.money !== false && !f.unit ? 'pl-8' : ''} ${f.unit ? 'pr-10' : ''} ${simulation?.errors?.[f.key] ? 'border-red-400' : ''}`}
                    />
                    {f.unit && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">{f.unit}</span>
                    )}
                  </div>
                  {f.hint && <p className="text-xs text-gray-400 mt-1">{f.hint}</p>}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Cotizar por ti">
            <label className={`flex items-start gap-3 text-sm ${complete ? 'text-gray-700' : 'text-gray-400'}`}>
              <input
                type="checkbox"
                className="mt-0.5"
                checked={autoQuote}
                disabled={!complete && !autoQuote}
                onChange={(e) => setAutoQuote(e.target.checked)}
              />
              <span>
                Autorizo a Chalán a cotizar por mí con estas tarifas cuando no responda una orden en 20 minutos,
                solo en los días que tengo libres en mi disponibilidad. Puedo cambiar o rechazar esa cotización
                mientras el cliente no la elija.
              </span>
            </label>
            {!complete && <p className="text-xs text-gray-400 mt-2 ml-6">Llena al menos la base y el precio por m³.</p>}
            {authorized && (
              <p className="text-xs text-gray-500 mt-2 ml-6">
                Autorizado por {saved.auto_quote_authorized_by.name}
                {!saved.auto_quote_authorized_by.is_company && ' (Chalán)'} el{' '}
                {new Date(saved.auto_quote_authorized_at).toLocaleDateString('es-PE')}.
              </p>
            )}
            <p className="text-xs text-gray-500 mt-3 ml-6">
              Todavía no cotizamos por nadie: antes de empezar te avisamos.
            </p>
          </Card>

          <button
            type="submit"
            disabled={saving}
            className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg"
          >
            {saving ? 'Guardando…' : 'Guardar tarifas'}
          </button>
        </div>

        <aside className="lg:sticky lg:top-6 space-y-6">
          {accuracy && <AccuracyCard accuracy={accuracy} />}
          <Card title="Cuánto cobrarías">
            {!complete && (
              <p className="text-sm text-gray-400">Escribe la base y el precio por m³ para ver los totales.</p>
            )}
            <ul className="divide-y divide-gray-100">
              {SCENARIOS.map((s, i) => {
                const result = simulation?.results?.[i]
                return (
                  <li key={s.label} className="py-3">
                    <button
                      type="button"
                      onClick={() => setOpen(open === i ? null : i)}
                      className="w-full flex items-start justify-between gap-3 text-left"
                    >
                      <span>
                        <span className="block text-sm font-medium text-gray-800">{s.label}</span>
                        <span className="block text-xs text-gray-400">{s.detail}</span>
                      </span>
                      <span className="text-base font-semibold text-gray-900 whitespace-nowrap">
                        {result ? `S/ ${result.total.toLocaleString('es-PE')}` : '—'}
                      </span>
                    </button>
                    {open === i && result && (
                      <dl className="mt-2 space-y-1 text-xs text-gray-500">
                        {result.lines.map((line) => (
                          <div key={line.label} className="flex justify-between gap-3">
                            <dt>{line.label}</dt>
                            <dd>S/ {line.amount.toLocaleString('es-PE')}</dd>
                          </div>
                        ))}
                        {result.minimum_applied && (
                          <p className="text-amber-700">No llega a la tarifa mínima: se cobra la mínima.</p>
                        )}
                      </dl>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>
        </aside>
      </form>
    </div>
  )
}

// Solo admins: cuánto se parece lo que sale con sus tarifas a lo que la empresa
// cotiza de verdad (backoffice-api api/auto_quote.py). Decide a quién encender.
function AccuracyCard({ accuracy: a }) {
  const pct = (n) => `${Math.round(n * 100)}%`
  return (
    <Card title="Cuánto acierta (solo Chalán)">
      {a.compared === 0 ? (
        <p className="text-sm text-gray-500">
          {a.estimated === 0
            ? 'Todavía no se calculó ninguna orden con estas tarifas.'
            : `${a.estimated === 1 ? 'Se calculó 1 orden' : `Se calcularon ${a.estimated} órdenes`}, pero no cotizó ninguna para comparar.`}
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-700">
            En <span className="font-medium">{a.hits} de {a.compared}</span> órdenes quedó a menos de{' '}
            {pct(a.tolerance)} de lo que cotizó ({pct(a.share)}). Diferencia típica: {a.median_error > 0 ? '+' : ''}
            {pct(a.median_error)}.
          </p>
          <p className={`text-xs mt-2 ${a.ready ? 'text-green-700' : 'text-gray-500'}`}>
            {a.ready
              ? 'Acierta lo suficiente para cotizar por ella.'
              : `Para cotizar por ella: ${a.ready_min_compared} órdenes comparadas y ${pct(a.ready_share)} de aciertos.`}
          </p>
          <ul className="mt-3 space-y-0.5 text-xs text-gray-500">
            {a.recent.slice(0, 8).map((r) => (
              <li key={`${r.order_id}-${r.notified_at}`} className="flex justify-between gap-3">
                <span>Orden #{r.order_id}: S/ {r.amount} vs S/ {r.quoted}</span>
                <span className={Math.abs(r.error) <= a.tolerance ? 'text-green-700' : 'text-red-600'}>
                  {r.error > 0 ? '+' : ''}{Math.round(r.error * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
