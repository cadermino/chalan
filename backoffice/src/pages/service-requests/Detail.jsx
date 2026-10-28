import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import client from '../../api/client'
import Card from '../../components/Card'
import ClientContact from '../../components/ClientContact'
import CopyButton, { CopyRow } from '../../components/CopyButton'
import ServiceRequestView, { formatDay, formatMoney, formatTimestamp } from '../../components/ServiceRequestView'
import { DeclinesList } from '../../components/DeclinePanel'
import ServiceProspects from '../../components/ServiceProspects'
import { useAuth } from '../../contexts/AuthContext'

// El link se arma con el origen actual, así sirve igual en local y en producción.
function carrierUrl(token) {
  return `${window.location.origin}${import.meta.env.BASE_URL}carrier-view/${token}`
}

// Mensaje listo para pegarle al cliente por WhatsApp, con el total que ya incluye la comisión.
function customerMessage(request, quotation) {
  const service = (request.service_type?.name || 'servicio').toLowerCase()
  const where = request.neighborhood ? ` en ${request.neighborhood}` : ''
  return `Hola, tenemos tu cotización de ${service} para el ${formatDay(request.preferred_date)}${where}: ${formatMoney(quotation.total_amount)}. ¿Confirmamos?`
}

function Quotations({ request, busy, confirmingId, onAskConfirm, onSelect }) {
  const quotations = request.quotations || []
  // Con el saldo cobrado el trabajo ya se hizo: la API rechaza cambiar de transportista.
  const canPick = !isDraft(request) && ['pending', 'in_progress'].includes(request.status)
  const selected = quotations.find((q) => q.status === 'selected')
  const lowest = quotations.length > 1 ? Math.min(...quotations.map((q) => q.amount)) : null
  const feePercent = Number((request.platform_fee_rate * 100).toFixed(2))

  return (
    <Card title={`Cotizaciones (${quotations.length})`} className="mt-4">
      {quotations.length === 0
        ? <p className="text-sm text-gray-500">Aún no llegan cotizaciones.</p>
        : (
          <>
            <ul className="divide-y divide-gray-100">
              {quotations.map((q) => {
                const isSelected = q.status === 'selected'
                return (
                  <li key={q.id} className={`py-3 ${isSelected ? 'rounded-lg bg-teal-50 px-3' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {q.carrier_company_name}
                          {isSelected && (
                            <span className="ml-2 rounded-full bg-teal-600 px-2 py-0.5 text-xs text-white">
                              {q.selected_by_customer ? 'Elegida por el cliente' : 'Elegida'}
                            </span>
                          )}
                          {!isSelected && q.amount === lowest && (
                            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Más barata</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">Actualizada {formatTimestamp(q.updated_date)}</p>
                        {q.note && <p className="mt-1 text-sm text-gray-600">“{q.note}”</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Transportista: {formatMoney(q.amount)}</p>
                        <p className="text-lg font-bold text-gray-900">{formatMoney(q.total_amount)}</p>
                        <p className="text-xs text-gray-400">total para el cliente</p>
                      </div>
                    </div>

                    {canPick && !isSelected && confirmingId !== q.id && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onAskConfirm(q.id)}
                        className="mt-2 rounded-lg border border-teal-600 px-3 py-1.5 text-xs text-teal-600 hover:bg-teal-50 disabled:opacity-50"
                      >
                        Elegir
                      </button>
                    )}
                    {canPick && !isSelected && confirmingId === q.id && (
                      <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 p-3">
                        <p className="flex-1 text-sm text-teal-800">
                          {selected
                            ? `Esto reemplaza a ${selected.carrier_company_name} como cotización elegida.`
                            : `Elegir a ${q.carrier_company_name} a ${formatMoney(q.total_amount)} para el cliente.`}
                        </p>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onSelect(q.id)}
                          className="rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                        >
                          Sí, elegir
                        </button>
                        <button type="button" disabled={busy} onClick={() => onAskConfirm(null)} className="text-sm text-gray-600 hover:underline">
                          No
                        </button>
                      </div>
                    )}
                    {isSelected && (
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <CopyButton text={customerMessage(request, q)} label="Copiar mensaje para el cliente" />
                        {request.whatsapp && <CopyButton text={request.whatsapp} label="Copiar número" />}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-xs text-gray-400">
              El total incluye la comisión de Chalán ({feePercent}%). Una vez elegida, queda congelado aunque la comisión cambie.
            </p>
          </>
        )}
    </Card>
  )
}

// Los mismos estados que una orden. Un pendiente sin submitted_at es un borrador:
// el cliente no terminó el formulario y no se le avisó a nadie.
const STATUS_LABEL = { pending: 'Pendiente', in_progress: 'En progreso', completed: 'Completado', cancelled: 'Cancelado' }
const STATUS_STYLE = {
  pending: 'bg-amber-50 text-amber-700',
  in_progress: 'bg-blue-50 text-blue-700',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
}
const isDraft = (request) => request.status === 'pending' && !request.submitted_at

// Cambiar el estado a mano (superadmin, como en Editar orden): para lo que pasó
// fuera del sistema. La API lo vuelve a calcular si después cambia la elección
// o un pago. Un borrador solo se puede cancelar.
function StatusEditor({ request, busy, onSave }) {
  const [value, setValue] = useState(request.status)
  useEffect(() => { setValue(request.status) }, [request.status])
  const options = isDraft(request) ? ['pending', 'cancelled'] : Object.keys(STATUS_LABEL)

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="status-editor" className="sr-only">Cambiar estado</label>
      <select
        id="status-editor"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy}
        className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      >
        {options.map((key) => <option key={key} value={key}>{STATUS_LABEL[key]}</option>)}
      </select>
      {value !== request.status && (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave(value)}
            className="rounded-lg bg-teal-600 px-3 py-1 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            Guardar estado
          </button>
          <button type="button" disabled={busy} onClick={() => setValue(request.status)} className="text-xs text-gray-500 hover:underline">
            Deshacer
          </button>
        </>
      )}
    </div>
  )
}

const CONCEPT_LABEL = { reservation: 'Reserva por Yape', carrier_cash: 'Saldo en efectivo al transportista' }
const PAYMENT_LABEL = {
  reservation: { pending: 'Por verificar', paid: 'Confirmada', cancelled: 'No llegó' },
  carrier_cash: { paid: 'Pagado', cancelled: 'Anulado' },
}
const PAYMENT_STYLE = {
  pending: 'bg-amber-100 text-amber-800',
  paid: 'bg-teal-100 text-teal-800',
  cancelled: 'bg-gray-200 text-gray-600',
}

function ConfirmBar({ text, busy, onYes, onNo }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 p-3">
      <p className="flex-1 text-sm text-teal-800">{text}</p>
      <button
        type="button"
        disabled={busy}
        onClick={onYes}
        className="rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
      >
        Sí
      </button>
      <button type="button" disabled={busy} onClick={onNo} className="text-sm text-gray-600 hover:underline">
        No
      </button>
    </div>
  )
}

// La plata de la solicitud: la reserva que el cliente le yapea a Chalán y el
// saldo que le paga al transportista el día del servicio. Yape personal no tiene
// webhook: alguien busca la reserva en la app y la confirma acá, o la registra si
// el cliente nunca la informó en su página (la eligió un admin, o se cerró por
// WhatsApp). Confirmarla o registrarla le avisa al transportista. El saldo se
// registra al terminar el trabajo, y es lo que deja la solicitud completada.
function Payments({ request, busy, confirming, onAskConfirm, onResolve, onRegister, onCarrierCash }) {
  const [operationNumber, setOperationNumber] = useState('')
  // Un servicio que ya se hizo y se registra tarde no tiene a quién avisar.
  const [notify, setNotify] = useState(true)
  const payments = request.payments || []
  const selected = (request.quotations || []).find((q) => q.status === 'selected')
  if (payments.length === 0 && !selected) return null
  const quotationName = Object.fromEntries((request.quotations || []).map((q) => [q.id, q.carrier_company_name]))
  const carrier = selected?.carrier_company_name || 'el transportista'
  const live = (concept) => selected && payments.find((p) => p.concept === concept
    && p.quotation_id === selected.id && p.status !== 'cancelled')
  const reservation = live('reservation')
  const cash = live('carrier_cash')
  const active = !isDraft(request) && request.status !== 'cancelled'
  const reservationAmount = selected ? selected.total_amount - selected.amount : null

  return (
    <Card title="Pagos" className="mt-4">
      {payments.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {payments.slice().reverse().map((p) => (
            <li key={p.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-900">
                    {CONCEPT_LABEL[p.concept] || p.concept}
                    {p.reference && <> · N.º de operación <span className="font-semibold">{p.reference}</span></>}
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${PAYMENT_STYLE[p.status] || ''}`}>
                      {PAYMENT_LABEL[p.concept]?.[p.status] || p.status}
                    </span>
                  </p>
                  <p className="text-xs text-gray-400">
                    {quotationName[p.quotation_id] || 'Cotización'} · {p.concept === 'reservation' && p.status === 'pending' ? 'informada' : 'registrada'} {formatTimestamp(p.created_date)}
                    {p.paid_at && p.concept === 'reservation' && ` · confirmada ${formatTimestamp(p.paid_at)}`}
                  </p>
                </div>
                <p className="text-lg font-bold text-gray-900">{formatMoney(p.amount)}</p>
              </div>
              {p.concept === 'reservation' && p.status === 'pending' && !confirming && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onAskConfirm({ id: p.id, status: 'paid' })}
                    className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                  >
                    Confirmar yapeo
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onAskConfirm({ id: p.id, status: 'cancelled' })}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    No llegó
                  </button>
                </div>
              )}
              {p.concept === 'reservation' && p.status === 'pending' && confirming?.id === p.id && (
                <ConfirmBar
                  busy={busy}
                  text={confirming.status === 'paid'
                    ? `Confirmar el yapeo de ${formatMoney(p.amount)}: se le avisa a ${quotationName[p.quotation_id] || 'el transportista'} y al cliente.`
                    : 'Marcarlo como no llegado: la cotización se libera y el cliente puede volver a elegir.'}
                  onYes={() => onResolve(p.id, confirming.status)}
                  onNo={() => onAskConfirm(null)}
                />
              )}
              {p.id === cash?.id && active && (
                confirming?.action === 'undo_cash'
                  ? (
                    <ConfirmBar
                      busy={busy}
                      text="Anular el saldo registrado: el servicio vuelve a En proceso."
                      onYes={() => onCarrierCash('delete')}
                      onNo={() => onAskConfirm(null)}
                    />
                  )
                  : !confirming && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onAskConfirm({ action: 'undo_cash' })}
                      className="mt-1 text-xs text-gray-400 hover:underline disabled:opacity-50"
                    >
                      Deshacer
                    </button>
                  )
              )}
            </li>
          ))}
        </ul>
      )}

      {active && selected && !reservation && (
        <div className={payments.length > 0 ? 'mt-3 border-t border-gray-100 pt-3' : ''}>
          <p className="text-sm text-gray-700">
            Falta la reserva de {formatMoney(reservationAmount)}: sin ella el trabajo no está agendado. Si el cliente ya
            te la yapeó, regístrala.
          </p>
          {confirming?.action === 'register' ? (
            <ConfirmBar
              busy={busy}
              text={notify
                ? `Registrar la reserva de ${formatMoney(reservationAmount)} como pagada: se le avisa a ${carrier} y al cliente.`
                : `Registrar la reserva de ${formatMoney(reservationAmount)} como pagada, sin avisarle a nadie.`}
              onYes={() => onRegister(operationNumber, notify)}
              onNo={() => onAskConfirm(null)}
            />
          ) : !confirming && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={operationNumber}
                onChange={(e) => setOperationNumber(e.target.value)}
                placeholder="N.º de operación (opcional)"
                aria-label="Número de operación del yapeo"
                className="w-56 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => onAskConfirm({ action: 'register' })}
                className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                Registrar reserva pagada
              </button>
              <label className="flex w-full items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={notify}
                  onChange={(e) => setNotify(e.target.checked)}
                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                Avisar a {carrier} y al cliente (desmárcalo si el servicio ya se hizo)
              </label>
            </div>
          )}
        </div>
      )}

      {active && reservation?.status === 'paid' && !cash && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-sm text-gray-700">
            Cuando el cliente le pague {formatMoney(selected.amount)} a {carrier} el día del servicio, regístralo: el
            servicio queda completado.
          </p>
          {confirming?.action === 'cash' ? (
            <ConfirmBar
              busy={busy}
              text={`¿El cliente ya le pagó ${formatMoney(selected.amount)} a ${carrier}? No se le avisa a nadie.`}
              onYes={() => onCarrierCash('post')}
              onNo={() => onAskConfirm(null)}
            />
          ) : !confirming && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAskConfirm({ action: 'cash' })}
              className="mt-2 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              Registrar saldo pagado
            </button>
          )}
        </div>
      )}

      {payments.some((p) => p.concept === 'reservation' && p.status === 'pending') && (
        <p className="mt-3 text-xs text-gray-400">Busca la reserva en Yape por el número de operación y el monto antes de confirmarla.</p>
      )}
    </Card>
  )
}

export default function ServiceRequestDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [request, setRequest] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Cancelar avisa a los transportistas, así que pide un segundo clic (como las
  // cotizaciones) en vez de un confirm() del navegador, que corta la página entera.
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  // Elegir una cotización también pide un segundo clic: le dice al equipo cuál es el
  // precio del cliente, y elegir otra después reemplaza a la anterior.
  const [confirmingSelectId, setConfirmingSelectId] = useState(null)
  // Lo que espera el segundo clic en Pagos: { id, status } de un yapeo por
  // confirmar o rechazar, o { action } para registrar la reserva o el saldo.
  const [confirmingPayment, setConfirmingPayment] = useState(null)

  const load = () =>
    client.get(`/api/service-requests/${id}`)
      .then(({ data }) => setRequest(data.service_request))
      .catch((err) => setError(err.response?.status === 404 ? 'El servicio no existe.' : 'No se pudo cargar.'))

  useEffect(() => { load() }, [id])

  const resend = async () => {
    setBusy(true)
    try {
      const { data } = await client.post(`/api/service-requests/${id}/notify-carriers`)
      const count = data.notified_carrier_ids.length
      toast.success(count ? `Avisamos a ${count} transportista(s)` : 'No había transportistas pendientes de avisar')
      await load()
    } catch (err) {
      toast.error(err.response?.status === 409
        ? 'Solo se puede reenviar un servicio ya enviado por el cliente'
        : 'No se pudo reenviar')
    } finally {
      setBusy(false)
    }
  }

  const selectQuotation = async (quotationId) => {
    setBusy(true)
    try {
      await client.post(`/api/service-requests/${id}/quotations/${quotationId}/select`)
      toast.success('Cotización elegida')
      setConfirmingSelectId(null)
      await load()
    } catch (err) {
      toast.error(err.response?.status === 409
        ? 'El servicio ya no admite elegir (¿fue cancelado?)'
        : 'No se pudo elegir la cotización')
    } finally {
      setBusy(false)
    }
  }

  const resolvePayment = async (paymentId, status) => {
    setBusy(true)
    try {
      await client.post(`/api/service-requests/${id}/payments/${paymentId}`, { status })
      toast.success(status === 'paid' ? 'Yapeo confirmado: avisamos al transportista y al cliente' : 'Marcado como no llegado')
      setConfirmingPayment(null)
      await load()
    } catch (err) {
      toast.error(err.response?.status === 409 ? 'Ese yapeo ya estaba resuelto' : 'No se pudo actualizar el yapeo')
    } finally {
      setBusy(false)
    }
  }

  const registerReservation = async (operationNumber, notify) => {
    setBusy(true)
    try {
      await client.post(`/api/service-requests/${id}/reservation`, { operation_number: operationNumber || null, notify })
      toast.success(notify ? 'Reserva registrada: avisamos al transportista y al cliente' : 'Reserva registrada, sin avisos')
      setConfirmingPayment(null)
      await load()
    } catch (err) {
      const message = err.response?.data?.message
      toast.error(message === 'invalid_operation_number'
        ? 'El número de operación no es válido'
        : message === 'operation_number_already_used'
          ? 'Ese número de operación ya se usó en otra reserva'
          : err.response?.status === 409
            ? 'Este servicio ya tiene una reserva'
            : 'No se pudo registrar la reserva')
    } finally {
      setBusy(false)
    }
  }

  const carrierCash = async (method) => {
    setBusy(true)
    try {
      await client[method](`/api/service-requests/${id}/carrier-cash`)
      toast.success(method === 'post' ? 'Saldo registrado: el servicio quedó completado' : 'Saldo anulado')
      setConfirmingPayment(null)
      await load()
    } catch (err) {
      toast.error(err.response?.status === 409
        ? 'La reserva todavía no está confirmada'
        : 'No se pudo actualizar el saldo')
    } finally {
      setBusy(false)
    }
  }

  const saveStatus = async (status) => {
    setBusy(true)
    try {
      await client.patch(`/api/service-requests/${id}`, { status })
      toast.success(`Estado cambiado a ${STATUS_LABEL[status]}`)
      await load()
    } catch (err) {
      toast.error(err.response?.status === 409 ? 'Un servicio incompleto solo se puede cancelar' : 'No se pudo cambiar el estado')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    setBusy(true)
    try {
      await client.patch(`/api/service-requests/${id}`, { status: 'cancelled' })
      toast.success('Servicio cancelado')
      setConfirmingCancel(false)
      await load()
    } catch (err) {
      toast.error('No se pudo cancelar')
    } finally {
      setBusy(false)
    }
  }

  if (error) return <p className="py-10 text-center text-gray-500">{error}</p>
  if (!request) return <p className="py-10 text-center text-gray-400">Cargando...</p>

  const pending = request.links.filter((l) => !l.notified).length
  const notifiedAt = Object.fromEntries(request.notifications.map((n) => [n.carrier_company_id, n.sent_at]))

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/service-requests" className="text-sm text-teal-600 hover:underline">← Servicios</Link>
        <h1 className="text-2xl font-bold text-gray-900">Servicio #{request.id}</h1>
        <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${STATUS_STYLE[request.status] || 'bg-gray-200 text-gray-700'}`}>
          {STATUS_LABEL[request.status] || request.status}
        </span>
        {isDraft(request) && (
          <span className="rounded-full bg-gray-200 px-3 py-0.5 text-xs font-medium text-gray-700">Incompleto</span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {/* Mientras no haya una elegida: el transportista elegido cotizó sobre lo que leyó.
              Un borrador se completa por el cliente y queda enviado. */}
          {!request.quotations.some((q) => q.status === 'selected') && (
            <Link
              to={`/service-requests/${request.id}/edit`}
              className="rounded-lg border border-teal-600 px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50"
            >
              {isDraft(request) ? 'Completar' : 'Editar'}
            </Link>
          )}
          {user?.role === 'superadmin' && <StatusEditor request={request} busy={busy} onSave={saveStatus} />}
        </div>
      </div>

      {/* Cliente — el mismo bloque que en el detalle de una orden */}
      <Card title="Cliente" className="mb-4">
        <ClientContact phone={request.whatsapp} emptyText="Aún no dejó su WhatsApp (no terminó el formulario)." />
        {request.customer_quotations_path && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <CopyRow
              title="Link del cliente"
              hint="Su página para ver y elegir las cotizaciones. No vence ni pide contraseña."
              text={`${window.location.origin}${request.customer_quotations_path}`}
            />
          </div>
        )}
      </Card>

      <ServiceRequestView request={request} />

      <Quotations
        request={request}
        busy={busy}
        confirmingId={confirmingSelectId}
        onAskConfirm={setConfirmingSelectId}
        onSelect={selectQuotation}
      />

      <Payments
        request={request}
        busy={busy}
        confirming={confirmingPayment}
        onAskConfirm={setConfirmingPayment}
        onResolve={resolvePayment}
        onRegister={registerReservation}
        onCarrierCash={carrierCash}
      />

      <div className="mt-4">
        <DeclinesList declines={request.declines} />
      </div>

      {/* Mientras nadie fue elegido: a quién más invitar a cotizar. */}
      {request.status !== 'cancelled' && !request.quotations.some((q) => q.status === 'selected') && (
        <ServiceProspects request={request} />
      )}

      <Card title="Transportistas" className="mt-4">
        {request.links.length === 0
          ? (
            <p className="text-sm text-gray-500">
              Ninguna empresa activa ofrece este servicio. Actívalo en el formulario de la empresa.
            </p>
          )
          : (
            <ul className="divide-y divide-gray-100">
              {request.links.map((link) => (
                <li key={link.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{link.name}</p>
                    <p className="text-xs text-gray-400">
                      {link.notified ? `Avisado ${formatTimestamp(notifiedAt[link.id])}` : 'Sin avisar'}
                    </p>
                  </div>
                  <CopyButton text={carrierUrl(link.token)} />
                </li>
              ))}
            </ul>
          )}

        <div className="mt-4 flex flex-wrap gap-3">
          {!isDraft(request) && request.status !== 'cancelled' && (
            <button
              type="button"
              disabled={busy || pending === 0}
              onClick={resend}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              Reenviar a transportistas no avisados{pending ? ` (${pending})` : ''}
            </button>
          )}
          {request.status !== 'cancelled' && !confirmingCancel && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmingCancel(true)}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Cancelar servicio
            </button>
          )}
          {request.status !== 'cancelled' && confirmingCancel && (
            <div className="flex w-full flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="flex-1 text-sm text-red-700">
                Los transportistas verán que ya no hace falta cotizar. ¿Cancelar el servicio?
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={cancel}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Sí, cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmingCancel(false)}
                className="text-sm text-gray-600 hover:underline"
              >
                No
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
