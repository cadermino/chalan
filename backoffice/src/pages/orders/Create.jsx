import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../../api/client'

export default function OrderCreate() {
  const navigate = useNavigate()

  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  const [form, setForm] = useState({
    originStreet: '',
    originFloor: '',
    originCountry: 'Perú',
    originDistanceFromParking: '',
    originHasElevator: false,
    destinationStreet: '',
    destinationFloor: '',
    destinationCountry: 'Perú',
    destinationDistanceFromParking: '',
    destinationHasElevator: false,
    appointmentDate: '',
    comments: '',
    approximateBudget: '',
    loadersQuantity: '',
    cargo: false,
    packaging: false,
  })
  const [images, setImages] = useState([])
  const [saving, setSaving] = useState(false)
  const [uploadWarning, setUploadWarning] = useState(null)
  const [createdOrderId, setCreatedOrderId] = useState(null)
  const [error, setError] = useState(null)

  // Revoke object URLs on unmount / when the selection changes, so previews
  // don't leak memory.
  useEffect(() => () => images.forEach(img => URL.revokeObjectURL(img.previewUrl)), [images])

  const addImages = (fileList) => {
    const files = Array.from(fileList).map(file => ({ file, previewUrl: URL.createObjectURL(file) }))
    setImages(prev => [...prev, ...files])
  }

  const removeImage = (index) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  const searchCustomers = async (q) => {
    setCustomerQuery(q)
    if (q.trim().length < 2) {
      setCustomerResults([])
      return
    }
    setSearching(true)
    try {
      const { data } = await client.get(`/api/customers?q=${encodeURIComponent(q)}`)
      setCustomerResults(data.customers)
    } finally {
      setSearching(false)
    }
  }

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer)
    setCustomerResults([])
    setCustomerQuery('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setUploadWarning(null)
    if (!selectedCustomer) {
      setError('Elegí un cliente antes de continuar')
      return
    }
    if (!form.originStreet.trim() || !form.destinationStreet.trim()) {
      setError('Origen y destino son obligatorios')
      return
    }
    setSaving(true)
    let orderId
    try {
      const { data } = await client.post('/api/orders', {
        customer_id: selectedCustomer.id,
        origin: {
          street: form.originStreet,
          floor_number: form.originFloor === '' ? null : Number(form.originFloor),
          country: form.originCountry,
          approximate_distance_from_parking: form.originDistanceFromParking === '' ? null : Number(form.originDistanceFromParking),
          has_elevator: form.originHasElevator,
        },
        destination: {
          street: form.destinationStreet,
          floor_number: form.destinationFloor === '' ? null : Number(form.destinationFloor),
          country: form.destinationCountry,
          approximate_distance_from_parking: form.destinationDistanceFromParking === '' ? null : Number(form.destinationDistanceFromParking),
          has_elevator: form.destinationHasElevator,
        },
        appointment_date: form.appointmentDate || null,
        comments: form.comments || null,
        approximate_budget: form.approximateBudget === '' ? null : Number(form.approximateBudget),
        loaders_quantity: form.loadersQuantity === '' ? null : Number(form.loadersQuantity),
        cargo: form.cargo,
        packaging: form.packaging,
      })
      orderId = data.order_id
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear la orden')
      setSaving(false)
      return
    }

    // The order already exists at this point - an image upload failure
    // shouldn't block navigating to it, just surface a warning there.
    let failedUploads = 0
    for (const img of images) {
      const formData = new FormData()
      formData.append('image', img.file)
      try {
        // eslint-disable-next-line no-await-in-loop
        await client.post(`/api/orders/${orderId}/images`, formData, {
          headers: { 'Content-Type': undefined },
        })
      } catch {
        failedUploads += 1
      }
    }

    setSaving(false)
    if (failedUploads > 0) {
      setUploadWarning(
        `La orden #${orderId} se creó correctamente, pero ${failedUploads} de ${images.length} imagen(es) no se pudieron subir.`
      )
      setCreatedOrderId(orderId)
      return
    }
    navigate(`/orders/${orderId}`)
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/orders" className="text-teal-600 hover:underline text-sm">← Órdenes</Link>
        <h1 className="text-2xl font-bold text-gray-900">Crear orden</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-xl shadow p-5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Cliente</label>
          {selectedCustomer ? (
            <div className="flex items-center justify-between border border-gray-300 rounded-md px-3 py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {selectedCustomer.full_name || selectedCustomer.email}
                </p>
                <p className="text-xs text-gray-500">{selectedCustomer.email} · {selectedCustomer.mobile_phone}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="text-xs text-teal-600 hover:underline"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={customerQuery}
                onChange={e => searchCustomers(e.target.value)}
                placeholder="Buscar por nombre, email o teléfono..."
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {searching && <p className="text-xs text-gray-400 mt-1">Buscando...</p>}
              {customerResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
                  {customerResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCustomer(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    >
                      <p className="font-medium text-gray-900">{c.full_name || c.email}</p>
                      <p className="text-xs text-gray-500">{c.email} · {c.mobile_phone}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow p-5 grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Fecha de mudanza</label>
            <input
              type="datetime-local"
              value={form.appointmentDate}
              onChange={e => setForm(f => ({ ...f, appointmentDate: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Presupuesto aproximado</label>
            <input
              type="number"
              value={form.approximateBudget}
              onChange={e => setForm(f => ({ ...f, approximateBudget: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="col-span-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Qué se va a mover</label>
            <textarea
              value={form.comments}
              onChange={e => setForm(f => ({ ...f, comments: e.target.value }))}
              rows={4}
              placeholder="Una cosa por línea"
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="col-span-2 flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.cargo}
                onChange={e => setForm(f => ({ ...f, cargo: e.target.checked }))}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              Necesita cargadores
            </label>
            {form.cargo && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Cantidad</label>
                <input
                  type="number"
                  min="1"
                  value={form.loadersQuantity}
                  onChange={e => setForm(f => ({ ...f, loadersQuantity: e.target.value }))}
                  className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.packaging}
                onChange={e => setForm(f => ({ ...f, packaging: e.target.checked }))}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              Necesita embalaje
            </label>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">
            Fotos de referencia
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Fotos que el cliente haya mandado por WhatsApp u otro medio (opcional).
          </p>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={e => { addImages(e.target.files); e.target.value = '' }}
            className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-teal-50 file:text-teal-700 file:text-sm hover:file:bg-teal-100"
          />
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-3 mt-4">
              {images.map((img, i) => (
                <div key={img.previewUrl} className="relative group">
                  <img
                    src={img.previewUrl}
                    alt=""
                    className="w-full h-24 object-cover rounded-md border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 bg-white/90 rounded-full w-5 h-5 flex items-center justify-center text-xs text-gray-600 hover:text-red-600 shadow"
                    aria-label="Quitar imagen"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <p className="text-xs font-bold text-teal-600 uppercase tracking-wide">Origen</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Calle</label>
              <input
                type="text"
                value={form.originStreet}
                onChange={e => setForm(f => ({ ...f, originStreet: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Piso</label>
              <input
                type="number"
                value={form.originFloor}
                onChange={e => setForm(f => ({ ...f, originFloor: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">País</label>
              <input
                type="text"
                value={form.originCountry}
                onChange={e => setForm(f => ({ ...f, originCountry: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Distancia al estacionamiento (m)</label>
              <input
                type="number"
                value={form.originDistanceFromParking}
                onChange={e => setForm(f => ({ ...f, originDistanceFromParking: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.originHasElevator}
                onChange={e => setForm(f => ({ ...f, originHasElevator: e.target.checked }))}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              Tiene ascensor
            </label>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <p className="text-xs font-bold text-teal-600 uppercase tracking-wide">Destino</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Calle</label>
              <input
                type="text"
                value={form.destinationStreet}
                onChange={e => setForm(f => ({ ...f, destinationStreet: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Piso</label>
              <input
                type="number"
                value={form.destinationFloor}
                onChange={e => setForm(f => ({ ...f, destinationFloor: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">País</label>
              <input
                type="text"
                value={form.destinationCountry}
                onChange={e => setForm(f => ({ ...f, destinationCountry: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Distancia al estacionamiento (m)</label>
              <input
                type="number"
                value={form.destinationDistanceFromParking}
                onChange={e => setForm(f => ({ ...f, destinationDistanceFromParking: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.destinationHasElevator}
                onChange={e => setForm(f => ({ ...f, destinationHasElevator: e.target.checked }))}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              Tiene ascensor
            </label>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        {uploadWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-center justify-between gap-4">
            <span>{uploadWarning}</span>
            <Link to={`/orders/${createdOrderId}`} className="shrink-0 text-teal-700 hover:underline font-medium">
              Ver orden →
            </Link>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Link
            to="/orders"
            className="px-5 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving || !!uploadWarning}
            className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Creando...' : 'Crear orden'}
          </button>
        </div>
      </form>
    </div>
  )
}
