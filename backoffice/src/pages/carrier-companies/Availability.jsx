import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import client from '../../api/client'
import Card from '../../components/Card'

// Los días que la empresa no puede trabajar (backoffice-api carrier_rates.py).
// Todo está disponible hasta que se diga lo contrario: un calendario que hay
// que abrir día por día queda vacío en dos semanas. La semana se marca una vez
// y encima se cambian días sueltos. Las mudanzas que ya tiene salen solas, de
// sus órdenes.

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre',
  'octubre', 'noviembre', 'diciembre']

// `blocked` es la parte del día que no puede.
const STATES = [
  { blocked: null, label: 'Libre todo el día', short: '' },
  { blocked: 'pm', label: 'Solo mañana', short: 'Mañana' },
  { blocked: 'am', label: 'Solo tarde', short: 'Tarde' },
  { blocked: 'day', label: 'No trabajo', short: 'No' },
]

const CELL = {
  null: 'bg-white text-gray-800 border-gray-200',
  am: 'bg-amber-50 text-amber-900 border-amber-200',
  pm: 'bg-amber-50 text-amber-900 border-amber-200',
  day: 'bg-gray-100 text-gray-400 border-gray-200',
}

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }

export default function CarrierAvailability() {
  const { companyId } = useParams()
  const [company, setCompany] = useState(null)
  const [month, setMonth] = useState(null)
  const [calendar, setCalendar] = useState(null)
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = (first) => {
    const params = first ? { from: iso(first), to: iso(new Date(first.getFullYear(), first.getMonth() + 1, 0)) } : {}
    return client.get(`/api/carrier-companies/${companyId}/availability`, { params }).then(({ data }) => {
      setCalendar(data)
      if (!first) setMonth(parse(data.days[0].date))
    })
  }

  useEffect(() => {
    client.get(`/api/carrier-companies/${companyId}`).then(({ data }) => setCompany(data.carrier_company))
    load()
  }, [companyId])

  const goTo = (delta) => {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1)
    setMonth(next)
    setSelected(null)
    load(next)
  }

  const run = async (request, message) => {
    setBusy(true)
    try {
      await request()
      await load(month)
      if (message) toast.success(message)
    } catch {
      toast.error('No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }

  const setWeekday = (weekday, blocked) => {
    const weekly = calendar.weekly.map((v, i) => (i === weekday ? blocked : v))
    run(() => client.put(`/api/carrier-companies/${companyId}/availability/weekly`, { weekly }))
  }

  const setDay = (day, body) => run(
    () => client.put(`/api/carrier-companies/${companyId}/availability/days/${day.date}`, body),
  )

  const setCapacity = (value) => run(
    () => client.put(`/api/carrier-companies/${companyId}/rates`, { moves_per_day: Number(value) }),
    'Guardado',
  )

  if (!calendar || !month) return <p className="text-sm text-gray-400">Cargando…</p>

  const today = calendar.today
  const lead = (parse(calendar.days[0].date).getDay() + 6) % 7
  const day = selected && calendar.days.find((d) => d.date === selected)
  const isCurrentMonth = month.getFullYear() === parse(today).getFullYear() && month.getMonth() === parse(today).getMonth()

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Link to="/carrier-companies" className="text-teal-600 hover:underline text-sm">← Empresas</Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Disponibilidad — <span className="text-teal-600">{company?.name ?? '…'}</span>
      </h1>
      <p className="text-sm text-gray-500 mb-6 max-w-2xl">
        Marca solo lo que no puedes: todos los días cuentan como libres hasta que digas lo contrario. Así no
        te pedimos cotizar mudanzas en días que no trabajas. Los días en que ya tienes una mudanza con
        Chalán se marcan solos.
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => goTo(-1)}
              disabled={isCurrentMonth || busy}
              className="px-3 py-1 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"
              aria-label="Mes anterior"
            >
              ←
            </button>
            <h2 className="text-base font-semibold text-gray-800 capitalize">
              {MONTHS[month.getMonth()]} {month.getFullYear()}
            </h2>
            <button
              type="button"
              onClick={() => goTo(1)}
              disabled={busy}
              className="px-3 py-1 rounded-lg text-gray-600 hover:bg-gray-100"
              aria-label="Mes siguiente"
            >
              →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1">
            {SHORT.map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: lead }, (_, i) => <div key={`lead-${i}`} />)}
            {calendar.days.map((d) => {
              const state = STATES.find((s) => s.blocked === d.blocked)
              const full = d.booked.length >= calendar.moves_per_day
              return (
                <button
                  key={d.date}
                  type="button"
                  disabled={!d.editable}
                  onClick={() => setSelected(d.date === selected ? null : d.date)}
                  className={`min-h-[3.5rem] rounded-lg border p-1 text-left align-top ${CELL[d.blocked]} ${
                    d.date === selected ? 'ring-2 ring-teal-500' : ''
                  } ${d.editable ? 'hover:border-teal-400' : 'opacity-40 cursor-default'}`}
                >
                  <span className={`block text-sm ${d.blocked === 'day' ? 'line-through' : ''} ${d.date === today ? 'font-bold text-teal-700' : ''}`}>
                    {parse(d.date).getDate()}
                  </span>
                  {d.blocked && d.blocked !== 'day' && (
                    <span className="block text-[10px] leading-tight">{state.short}</span>
                  )}
                  {d.booked.length > 0 && (
                    <span className={`block text-[10px] leading-tight font-medium ${full ? 'text-red-600' : 'text-teal-700'}`}>
                      {d.booked.length} mudanza{d.booked.length > 1 ? 's' : ''}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
            <span><span className="inline-block w-3 h-3 rounded border border-gray-200 bg-white align-middle mr-1" />Libre</span>
            <span><span className="inline-block w-3 h-3 rounded border border-amber-200 bg-amber-50 align-middle mr-1" />Medio día</span>
            <span><span className="inline-block w-3 h-3 rounded border border-gray-200 bg-gray-100 align-middle mr-1" />No trabaja</span>
          </div>

          {day && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-800 mb-2">
                {WEEKDAYS[(parse(day.date).getDay() + 6) % 7]} {parse(day.date).getDate()} de {MONTHS[parse(day.date).getMonth()]}
              </p>
              <div className="flex flex-wrap gap-2">
                {STATES.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    disabled={busy}
                    onClick={() => setDay(day, { blocked: s.blocked })}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${
                      day.blocked === s.blocked ? 'bg-teal-600 border-teal-600 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {day.source === 'day' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDay(day, { reset: true })}
                  className="mt-2 text-xs text-teal-600 hover:underline"
                >
                  Volver a lo de todas las semanas ({STATES.find((s) => s.blocked === calendar.weekly[(parse(day.date).getDay() + 6) % 7]).label.toLowerCase()})
                </button>
              )}
              {day.booked.length > 0 && (
                <p className="mt-3 text-xs text-gray-500">
                  Ya tiene{' '}
                  {day.booked.map((b, i) => (
                    <span key={b.order_id}>
                      {i > 0 && ', '}
                      <Link to={`/orders/${b.order_id}`} className="text-teal-600 hover:underline">la orden #{b.order_id}</Link>
                      {` (${b.part === 'am' ? 'mañana' : 'tarde'})`}
                    </span>
                  ))}.
                </p>
              )}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Todas las semanas">
            <ul className="space-y-2">
              {WEEKDAYS.map((name, i) => (
                <li key={name} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-700">{name}</span>
                  <select
                    value={calendar.weekly[i] ?? ''}
                    disabled={busy}
                    onChange={(e) => setWeekday(i, e.target.value || null)}
                    className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                  >
                    {STATES.map((s) => <option key={s.label} value={s.blocked ?? ''}>{s.label}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Mudanzas por día">
            <label className="block text-sm text-gray-600 mb-2" htmlFor="moves_per_day">
              ¿Cuántas mudanzas puedes hacer el mismo día? Con todas ocupadas, ese día cuenta como lleno.
            </label>
            <select
              id="moves_per_day"
              value={calendar.moves_per_day}
              disabled={busy}
              onChange={(e) => setCapacity(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Card>
        </div>
      </div>
    </div>
  )
}
