import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import client from '../api/client'
import { useAuth } from '../contexts/AuthContext'

const PERIODS = [7, 30, 90]
const DEFAULT_PERIOD = 30

const money = (n) => n == null
  ? '—'
  : `S/ ${Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 })}`

const pct = (part, whole) => whole ? `${Math.round((part / whole) * 100)} %` : null

// Un tiempo de respuesta en horas se lee mal pasado el día o por debajo de la
// hora ("0.2 h", "140 h"), así que se muestra en la unidad que corresponda.
function duration(hours) {
  if (hours == null) return '—'
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 48) return `${hours.toLocaleString('es-PE', { maximumFractionDigits: 1 })} h`
  return `${(hours / 24).toLocaleString('es-PE', { maximumFractionDigits: 1 })} días`
}

function shortDate(iso) {
  if (!iso) return 'sin fecha'
  return new Date(iso).toLocaleString('es-PE', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
  })
}

// Cambio contra el período anterior. Sin base (período anterior en cero o
// vacío) no hay porcentaje honesto que mostrar, así que no se muestra nada.
// `lowerIsBetter` es para tiempos: bajar es buena noticia.
function Delta({ current, previous, lowerIsBetter = false }) {
  if (current == null || !previous) return null
  const change = (current - previous) / previous
  if (Math.abs(change) < 0.005) {
    return <span className="text-xs text-gray-400">igual que antes</span>
  }
  const good = lowerIsBetter ? change < 0 : change > 0
  return (
    <span className={`text-xs font-medium ${good ? 'text-green-600' : 'text-red-600'}`}>
      {change > 0 ? '▲' : '▼'} {Math.abs(Math.round(change * 100))} %
    </span>
  )
}

function MetricCard({ label, value, sub, delta, to }) {
  const body = (
    <>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      <div className="flex flex-wrap items-center gap-x-2 mt-1 min-h-[1.25rem]">
        {sub && <span className="text-xs text-gray-500">{sub}</span>}
        {delta}
      </div>
    </>
  )
  const className = 'bg-white rounded-xl shadow p-4'
  return to
    ? <Link to={to} className={`${className} hover:shadow-md transition-shadow`}>{body}</Link>
    : <div className={className}>{body}</div>
}

function Section({ title, hint, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {hint && <p className="text-sm text-gray-500 mt-0.5">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

// Lista corta de órdenes que piden acción. El total va arriba aunque solo se
// listen unas pocas, y "Ver todas" lleva a la lista de órdenes ya filtrada y
// ordenada para mostrar esas mismas primero.
function AttentionCard({ title, why, data, to, renderMeta, tone = 'amber' }) {
  const tones = {
    amber: 'border-amber-400',
    red: 'border-red-400',
    blue: 'border-blue-400',
  }
  return (
    <div className={`bg-white rounded-xl shadow p-4 border-l-4 ${data.total ? tones[tone] : 'border-gray-200'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium text-gray-900">{title}</h3>
        <span className={`text-xl font-bold ${data.total ? 'text-gray-900' : 'text-gray-300'}`}>{data.total}</span>
      </div>
      <p className="text-xs text-gray-500 mt-0.5">{why}</p>
      {data.total === 0 ? (
        <p className="text-sm text-green-600 mt-3">Nada pendiente ✓</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {data.items.map((o) => (
              <li key={o.id} className="py-1.5 flex items-center justify-between gap-3">
                <Link to={`/orders/${o.id}`} className="text-teal-700 hover:underline font-medium shrink-0">
                  #{o.id}
                </Link>
                <span className="text-gray-500 text-right truncate">{renderMeta(o)}</span>
              </li>
            ))}
          </ul>
          {to && data.total > data.items.length && (
            <Link to={to} className="text-xs text-teal-700 hover:underline mt-2 inline-block">
              Ver las {data.total} →
            </Link>
          )}
        </>
      )}
    </div>
  )
}

function who(o) {
  return [o.customer_name, o.phone].filter(Boolean).join(' · ') || 'sin datos de contacto'
}

function AdminDashboard({ data }) {
  const { attention: a, funnel, supply, money: m, deposits, agent_commissions: commissions } = data
  const f = funnel.current
  const fp = funnel.previous
  const s = supply.current
  const sp = supply.previous

  return (
    <>
      <Section title="Para atender hoy" hint="Órdenes que necesitan que alguien haga algo.">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AttentionCard
            title="Sin cotizaciones hace más de 24 h"
            why="Pendientes de la última semana que ningún transportista cotizó. Todavía se salvan si se empuja a las empresas."
            data={a.cooling}
            to="/orders?sort=quotations&dir=asc"
            renderMeta={o => `creada ${shortDate(o.created_date)}`}
          />
          <AttentionCard
            title="Adjudicadas sin adelanto registrado"
            why="El cliente eligió transportista pero no hay pagos cargados. Se registran desde el detalle de la orden."
            data={a.unregistered}
            tone="red"
            to="/orders?status=2&sort=deposit"
            renderMeta={o => `mudanza ${shortDate(o.appointment_date)}`}
          />
          <AttentionCard
            title="Mudanzas en 7 días con adelanto pendiente"
            why="Se mudan esta semana y el adelanto todavía no está cobrado."
            data={a.upcoming_unpaid}
            tone="red"
            to="/orders?status=2&sort=appointment&dir=asc"
            renderMeta={o => `${shortDate(o.appointment_date)} · ${money(o.amount)}`}
          />
          <AttentionCard
            title="Órdenes solo con teléfono"
            why="Pendientes de la última semana sin cliente registrado. Hay que llamar para completarlas."
            data={a.leads}
            tone="blue"
            to="/orders?sort=customer&dir=asc"
            renderMeta={who}
          />
        </div>
        {a.stale_pending > 0 && (
          <p className="text-sm text-gray-500 mt-3">
            Además hay <strong className="text-gray-700">{a.stale_pending}</strong> órdenes pendientes con más de una semana, casi seguro abandonadas.{' '}
            <Link to="/orders?sort=created&dir=asc" className="text-teal-700 hover:underline">
              Revisarlas y cancelarlas en bloque →
            </Link>
          </p>
        )}
      </Section>

      <Section
        title="Embudo"
        hint={`Órdenes creadas en los últimos ${data.days} días y hasta dónde llegaron. La comparación es contra los ${data.days} días anteriores.`}
      >
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard label="Creadas" value={f.created}
            delta={<Delta current={f.created} previous={fp.created} />} />
          <MetricCard label="Con al menos una cotización" value={f.quoted} sub={pct(f.quoted, f.created)}
            delta={<Delta current={f.quoted} previous={fp.quoted} />} />
          <MetricCard label="Adjudicadas" value={f.awarded} sub={pct(f.awarded, f.created)}
            delta={<Delta current={f.awarded} previous={fp.awarded} />} />
          <MetricCard label="Completadas" value={f.completed} sub={pct(f.completed, f.created)}
            delta={<Delta current={f.completed} previous={fp.completed} />} />
          <MetricCard label="Canceladas" value={f.cancelled} sub={pct(f.cancelled, f.created)}
            delta={<Delta current={f.cancelled} previous={fp.cancelled} lowerIsBetter />} />
        </div>
        {f.completed === 0 && f.awarded > 0 && (
          <p className="text-xs text-amber-700 mt-2">
            Hay órdenes adjudicadas pero ninguna marcada como completada: si las mudanzas ya ocurrieron, falta cerrarlas y el embudo se corta aquí.
          </p>
        )}
      </Section>

      <Section title="Transportistas" hint={`Cómo responde la oferta a las órdenes de los últimos ${data.days} días.`}>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard label="Empresas que cotizaron" value={s.quoting_carriers}
            sub={`de ${s.active_carriers} activas`}
            delta={<Delta current={s.quoting_carriers} previous={sp.quoting_carriers} />}
            to="/carrier-companies" />
          <MetricCard label="Tiempo hasta la primera cotización" value={duration(s.median_first_quote_hours)}
            sub="mediana"
            delta={<Delta current={s.median_first_quote_hours} previous={sp.median_first_quote_hours} lowerIsBetter />} />
          <MetricCard label="Cotizaciones por orden" value={s.quotes_per_order ?? '—'}
            sub="promedio"
            delta={<Delta current={s.quotes_per_order} previous={sp.quotes_per_order} />} />
        </div>
      </Section>

      <Section title="Plata" hint={`Montos de las órdenes creadas en los últimos ${data.days} días que ya se adjudicaron. Los adelantos y comisiones son el estado de hoy.`}>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard label="Monto adjudicado" value={money(m.current.gmv)}
            sub="lo que pagan los clientes"
            delta={<Delta current={m.current.gmv} previous={m.previous.gmv} />} />
          <MetricCard label="Ingreso de Chalán" value={money(m.current.platform_income)}
            sub="fee, con IGV"
            delta={<Delta current={m.current.platform_income} previous={m.previous.platform_income} />} />
          <MetricCard label="Ticket promedio" value={money(m.current.avg_ticket)}
            delta={<Delta current={m.current.avg_ticket} previous={m.previous.avg_ticket} />} />
          <MetricCard label="Adelantos por cobrar" value={money(deposits.pending_amount)}
            sub={`${deposits.pending_count} pendientes · ${deposits.unregistered_count} sin registrar`} />
          <MetricCard label={`Adelantos cobrados (${data.days} días)`} value={money(deposits.paid_amount)}
            sub={`${deposits.paid_count} pagos`} />
          <MetricCard label="Comisiones de agentes en curso" value={money(commissions.amount)}
            sub={`${commissions.count} órdenes referidas`}
            to="/admin-referred-orders" />
        </div>
      </Section>
    </>
  )
}

function CarrierDashboard({ data }) {
  const { opportunities: op, performance, upcoming, rating } = data
  const p = performance.current
  const pp = performance.previous
  const faster = p.response_hours != null && p.market_response_hours != null
    && p.response_hours <= p.market_response_hours

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <AttentionCard
          title="Órdenes esperando tu cotización"
          why={`${op.new_this_week} nuevas esta semana. Ordenadas por fecha de mudanza: las primeras son las más urgentes.`}
          data={op}
          to="/orders"
          renderMeta={o => `mudanza ${shortDate(o.appointment_date)}`}
        />
        <AttentionCard
          title="Tus próximas mudanzas"
          why={upcoming.total ? `Por cobrar en efectivo: ${money(upcoming.amount)}` : 'Órdenes que ganaste y todavía no se hacen.'}
          data={upcoming}
          tone="blue"
          to="/orders/my-orders"
          renderMeta={o => `${shortDate(o.appointment_date)} · ${money(o.amount)}`}
        />
      </div>

      <Section title="Tu rendimiento" hint={`Últimos ${data.days} días, comparado con los ${data.days} anteriores.`}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Cotizaciones enviadas" value={p.sent}
            delta={<Delta current={p.sent} previous={pp.sent} />} />
          <MetricCard label="Ganadas" value={p.won}
            sub={p.win_rate != null ? `${Math.round(p.win_rate * 100)} % de las enviadas` : null}
            delta={<Delta current={p.won} previous={pp.won} />} />
          <MetricCard
            label="Tu tiempo de respuesta"
            value={duration(p.response_hours)}
            sub={p.market_response_hours != null ? (
              <span className={faster ? 'text-green-600' : 'text-amber-700'}>
                mercado: {duration(p.market_response_hours)}
                {p.response_hours != null && (faster ? ' · respondes más rápido' : ' · otros responden antes')}
              </span>
            ) : null}
            delta={<Delta current={p.response_hours} previous={pp.response_hours} lowerIsBetter />}
          />
          <MetricCard
            label="Calificación"
            value={rating.average != null ? `${rating.average.toLocaleString('es-PE')} ★` : '—'}
            sub={rating.count ? `${rating.count} reseña${rating.count === 1 ? '' : 's'}` : 'todavía sin reseñas'}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          El tiempo de respuesta es la mediana entre que se crea la orden y llega la cotización. Responder antes que el resto suele ser lo que decide quién gana.
        </p>
      </Section>
    </>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const days = PERIODS.includes(Number(searchParams.get('days')))
    ? Number(searchParams.get('days'))
    : DEFAULT_PERIOD

  const { data, isPending, isError, refetch, isPlaceholderData } = useQuery({
    queryKey: ['dashboard', user?.role, days],
    queryFn: ({ signal }) => client.get(`/api/dashboard?days=${days}`, { signal }).then(r => r.data),
    placeholderData: keepPreviousData,
  })

  const setDays = (d) => setSearchParams(d === DEFAULT_PERIOD ? {} : { days: String(d) })

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex gap-1" role="group" aria-label="Período">
          {PERIODS.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={`text-sm px-3 py-1.5 rounded-lg border ${
                days === d
                  ? 'bg-teal-600 border-teal-600 text-white'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {d} días
            </button>
          ))}
        </div>
      </div>

      {isPending ? (
        <p className="text-gray-500">Cargando...</p>
      ) : isError ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex justify-between items-center gap-4">
          <span>No se pudo cargar el dashboard.</span>
          <button type="button" onClick={() => refetch()} className="font-medium">Reintentar</button>
        </div>
      ) : (
        <div className={`transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          {data.role === 'carrier' ? <CarrierDashboard data={data} /> : <AdminDashboard data={data} />}
        </div>
      )}
    </div>
  )
}
