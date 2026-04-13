import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import client from '../../api/client'
import toast from 'react-hot-toast'

const EMPTY = {
  name: '', description: '', rfc: '', email: '', phone: '',
  address: '', cover_image: '', facebook: '', youtube: '', active: true,
}

export default function CarrierCompanyForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isEdit) {
      client.get(`/api/carrier-companies/${id}`).then(({ data }) => {
        const c = data.carrier_company
        setForm({ ...c, active: Boolean(c.active) })
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
      if (isEdit) {
        await client.put(`/api/carrier-companies/${id}`, form)
        toast.success('Empresa actualizada')
      } else {
        await client.post('/api/carrier-companies', form)
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
