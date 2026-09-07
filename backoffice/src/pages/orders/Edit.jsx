import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import client from '../../api/client'

const STATUS_OPTIONS = [
  { value: 1, label: 'Pendiente' },
  { value: 2, label: 'En progreso' },
  { value: 3, label: 'Completado' },
  { value: 4, label: 'Cancelado' },
]

const NUMBER_FIELDS = new Set(['floor_number', 'approximate_distance_from_parking'])

function AddressFields({ title, values, onChange }) {
  const fields = [
    { key: 'street', label: 'Calle' },
    { key: 'country', label: 'País' },
    { key: 'floor_number', label: 'Piso' },
    { key: 'approximate_distance_from_parking', label: 'Distancia desde parqueo (m)' },
    { key: 'map_url', label: 'URL del mapa' },
  ]
  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      <p className="text-xs font-bold text-teal-600 uppercase tracking-wide">{title}</p>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">{label}</label>
            <input
              type={NUMBER_FIELDS.has(key) ? 'number' : 'text'}
              value={values[key] ?? ''}
              onChange={e => onChange(key, NUMBER_FIELDS.has(key) ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        ))}
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={!!values.has_elevator}
            onChange={e => onChange('has_elevator', e.target.checked)}
            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
          />
          Tiene ascensor
        </label>
      </div>
    </div>
  )
}

export default function OrderEdit() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [existingImages, setExistingImages] = useState([])
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadWarning, setUploadWarning] = useState(null)
  const [error, setError] = useState(null)
  const [deletingImageId, setDeletingImageId] = useState(null)

  useEffect(() => {
    client.get(`/api/orders/${orderId}`).then(({ data }) => {
      const o = data.order
      const addressDefaults = {
        street: '', country: '', floor_number: '',
        approximate_distance_from_parking: '', map_url: '', has_elevator: false,
      }
      setForm({
        appointment_date: o.appointment_date ? o.appointment_date.slice(0, 16) : '',
        order_status_id: o.order_status_id,
        approximate_budget: o.approximate_budget ?? '',
        total_kilometers: o.total_kilometers ?? '',
        comments: o.comments ?? '',
        lead_phone: o.lead_phone ?? '',
        loaders_quantity: o.loaders_quantity ?? '',
        origin: { ...addressDefaults, ...o.origin },
        destination: { ...addressDefaults, ...o.destination },
      })
      setExistingImages(o.images || [])
    }).finally(() => setLoading(false))
  }, [orderId])

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

  const deleteExistingImage = async (imageId) => {
    setDeletingImageId(imageId)
    setError(null)
    try {
      await client.delete(`/api/orders/${orderId}/images/${imageId}`)
      setExistingImages(prev => prev.filter(img => img.id !== imageId))
    } catch (err) {
      setError(err.response?.data?.message || 'Error al borrar la imagen')
    } finally {
      setDeletingImageId(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setUploadWarning(null)
    try {
      await client.put(`/api/orders/${orderId}`, {
        ...form,
        appointment_date: form.appointment_date || null,
        approximate_budget: form.approximate_budget === '' ? null : Number(form.approximate_budget),
        total_kilometers: form.total_kilometers === '' ? null : Number(form.total_kilometers),
        lead_phone: form.lead_phone === '' ? null : form.lead_phone,
        loaders_quantity: form.loaders_quantity === '' ? null : Number(form.loaders_quantity),
      })
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar')
      setSaving(false)
      return
    }

    // Order fields already saved at this point - an image upload failure
    // shouldn't block leaving the page, just surface a warning.
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
        `Los cambios se guardaron, pero ${failedUploads} de ${images.length} imagen(es) no se pudieron subir.`
      )
      return
    }
    navigate(`/orders/${orderId}`)
  }

  if (loading) return <p className="text-gray-500 p-8">Cargando...</p>
  if (!form) return <p className="text-red-500 p-8">Orden no encontrada</p>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/orders/${orderId}`} className="text-teal-600 hover:underline text-sm">← Orden #{orderId}</Link>
        <h1 className="text-2xl font-bold text-gray-900">Editar orden #{orderId}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-xl shadow p-5 grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Estado</label>
            <select
              value={form.order_status_id}
              onChange={e => setForm(f => ({ ...f, order_status_id: Number(e.target.value) }))}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Fecha de mudanza</label>
            <input
              type="datetime-local"
              value={form.appointment_date}
              onChange={e => setForm(f => ({ ...f, appointment_date: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Presupuesto aproximado</label>
            <input
              type="number"
              value={form.approximate_budget}
              onChange={e => setForm(f => ({ ...f, approximate_budget: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Kilómetros</label>
            <input
              type="number"
              value={form.total_kilometers}
              onChange={e => setForm(f => ({ ...f, total_kilometers: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Teléfono de contacto</label>
            <input
              type="tel"
              value={form.lead_phone}
              onChange={e => setForm(f => ({ ...f, lead_phone: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Cantidad de cargadores</label>
            <input
              type="number"
              value={form.loaders_quantity}
              onChange={e => setForm(f => ({ ...f, loaders_quantity: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="col-span-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">Comentarios</label>
            <textarea
              value={form.comments}
              onChange={e => setForm(f => ({ ...f, comments: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1">
            Fotos de referencia
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Fotos que el cliente haya mandado por WhatsApp u otro medio (opcional).
          </p>
          {existingImages.length > 0 && (
            <div className="grid grid-cols-4 gap-3 mb-4">
              {existingImages.map((img) => (
                <div key={img.id} className="relative group">
                  <a href={img.url} target="_blank" rel="noreferrer">
                    <img
                      src={img.url}
                      alt=""
                      className="w-full h-24 object-cover rounded-md border border-gray-200"
                    />
                  </a>
                  <button
                    type="button"
                    onClick={() => deleteExistingImage(img.id)}
                    disabled={deletingImageId === img.id}
                    className="absolute top-1 right-1 bg-white/90 rounded-full w-5 h-5 flex items-center justify-center text-xs text-gray-600 hover:text-red-600 shadow disabled:opacity-50"
                    aria-label="Borrar imagen"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
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

        <AddressFields
          title="Origen"
          values={form.origin}
          onChange={(key, val) => setForm(f => ({ ...f, origin: { ...f.origin, [key]: val } }))}
        />
        <AddressFields
          title="Destino"
          values={form.destination}
          onChange={(key, val) => setForm(f => ({ ...f, destination: { ...f.destination, [key]: val } }))}
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        {uploadWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-center justify-between gap-4">
            <span>{uploadWarning}</span>
            <Link to={`/orders/${orderId}`} className="shrink-0 text-teal-700 hover:underline font-medium">
              Ver orden →
            </Link>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Link
            to={`/orders/${orderId}`}
            className="px-5 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
