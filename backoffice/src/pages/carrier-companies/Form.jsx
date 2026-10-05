import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import client from '../../api/client'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'

const EMPTY = {
  name: '', description: '', rfc: '', email: '', phone: '',
  address: '', cover_image: '', facebook: '', youtube: '', active: true, country_id: '',
  service_type_ids: [],
}

export default function CarrierCompanyForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  // Qué servicios ofrece lo marca un admin: Chalán decide quién embala bien.
  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin'
  const [serviceTypes, setServiceTypes] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAdmin) {
      client.get('/api/service-types').then(({ data }) => setServiceTypes(data.service_types))
    }
    if (isEdit) {
      client.get(`/api/carrier-companies/${id}`).then(({ data }) => {
        const c = data.carrier_company
        setForm({ ...c, active: Boolean(c.active), country_id: c.country_id ?? '', service_type_ids: c.service_type_ids ?? [] })
      })
    }
  }, [id])

  const set = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: val }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = { ...form, country_id: form.country_id === '' ? null : Number(form.country_id) }
      // El servidor responde 403 si una empresa intenta cambiar sus propios servicios.
      if (!isAdmin) delete payload.service_type_ids
      if (isEdit) {
        await client.put(`/api/carrier-companies/${id}`, payload)
        toast.success('Empresa actualizada')
      } else {
        await client.post('/api/carrier-companies', payload)
        toast.success('Empresa creada')
      }
      navigate('/carrier-companies')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/carrier-companies" className="text-teal-600 hover:underline text-sm">← Empresas</Link>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Editar empresa' : 'Nueva empresa'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nombre *" span={2}>
            <input required value={form.name} onChange={set('name')} className="input" />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={set('email')} className="input" />
          </Field>
          <Field label="Teléfono">
            <input value={form.phone} onChange={set('phone')} className="input" />
          </Field>
          <Field label="RUC / RFC">
            <input value={form.rfc} onChange={set('rfc')} className="input" />
          </Field>
          <Field label="País (country_id)">
            <input
              type="number"
              value={form.country_id}
              onChange={set('country_id')}
              className="input"
              placeholder="2 = Perú"
            />
          </Field>
          <Field label="Dirección" span={2}>
            <input value={form.address} onChange={set('address')} className="input" />
          </Field>
          <Field label="Descripción" span={2}>
            <textarea rows={3} value={form.description} onChange={set('description')} className="input" />
          </Field>
          <Field label="Imagen de portada (URL)">
            <input value={form.cover_image} onChange={set('cover_image')} className="input" />
          </Field>
          <Field label="Facebook (URL)">
            <input value={form.facebook} onChange={set('facebook')} className="input" />
          </Field>
          <Field label="YouTube (URL)">
            <input value={form.youtube} onChange={set('youtube')} className="input" />
          </Field>
          {isAdmin && serviceTypes.length > 0 && (
            <Field label="Servicios que ofrece" span={2}>
              <div className="flex flex-wrap gap-4 mt-1">
                {serviceTypes.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.service_type_ids.includes(t.id)}
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        service_type_ids: e.target.checked
                          ? [...f.service_type_ids, t.id]
                          : f.service_type_ids.filter((id) => id !== t.id),
                      }))}
                      className="w-4 h-4 accent-teal-600"
                    />
                    <span className="text-sm">{t.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Las mudanzas llegan a todas las empresas activas. Esto marca quién recibe las solicitudes de estos otros servicios.
              </p>
            </Field>
          )}
          <Field label="Estado">
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input type="checkbox" checked={form.active} onChange={set('active')} className="w-4 h-4 accent-teal-600" />
              <span className="text-sm">Activa</span>
            </label>
          </Field>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-60"
          >
            {loading ? 'Guardando…' : 'Guardar'}
          </button>
          <Link to="/carrier-companies" className="text-sm text-gray-500 hover:underline self-center">Cancelar</Link>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children, span = 1 }) {
  return (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
