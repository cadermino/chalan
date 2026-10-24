import { useState } from 'react'
import axios from 'axios'
import client from '../api/client'

// La foto que ve el cliente en la página del transportista. Los clientes juzgan
// por lo que ven: una foto de otro camión los confunde. Espejo de los límites de
// app/api/vehicle_photos.py.
// La foto se achica antes de subir: el servidor acepta 10 MB, aquí se deja
// pasar más para no rechazar una foto grande que igual va a llegar chica.
const MAX_RAW_BYTES = 30 * 1024 * 1024
const CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp']
// Una foto de celular pesa 4–8 MB; a 1600 px de lado se ve bien en la página y
// sube rápido con datos móviles.
const MAX_SIDE = 1600

// Foto → JPEG achicado. Si el navegador no la sabe abrir, va tal cual.
async function prepare(file) {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return blob || file
  } catch {
    return file
  }
}

// Firma, sube directo a S3 (sin pasar por el backoffice-api) y la deja como la
// foto del vehículo. Devuelve la URL nueva.
async function uploadPhoto(base, file) {
  const blob = await prepare(file)
  const { data: signed } = await client.post(`${base}/presign`, { content_type: blob.type, size_bytes: blob.size })
  // axios pelado: sin baseURL ni el token del backoffice, que S3 rechazaría.
  // S3 exige que `file` sea el último campo del formulario.
  const form = new FormData()
  Object.entries(signed.upload.fields).forEach(([name, value]) => form.append(name, value))
  form.append('file', blob)
  await axios.post(signed.upload.url, form)
  const { data } = await client.post(base, { storage_key: signed.storage_key })
  return data.picture
}

export default function VehiclePhoto({ companyId, vehicleId, picture, onChange }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const base = `/api/carrier-companies/${companyId}/vehicles/${vehicleId}/photo`

  const upload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!CONTENT_TYPES.includes(file.type)) return setError('Solo fotos JPG, PNG o WEBP.')
    if (file.size > MAX_RAW_BYTES) return setError('La foto pesa más de 30 MB.')
    setBusy(true)
    setError(null)
    try {
      onChange(await uploadPhoto(base, file))
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo subir la foto.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await client.delete(base)
      onChange(null)
    } catch {
      setError('No se pudo borrar la foto.')
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <div className="space-y-2">
      {picture
        ? <img src={picture} alt="Foto del vehículo" className="max-h-56 rounded-lg border object-contain" />
        : <p className="text-sm text-amber-600">Sin foto: el cliente no ve cómo es el vehículo.</p>}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className={`inline-block cursor-pointer rounded-lg border border-teal-600 px-3 py-1.5 font-medium text-teal-700 hover:bg-teal-50 ${busy ? 'pointer-events-none opacity-60' : ''}`}>
          {busy ? 'Subiendo…' : picture ? 'Cambiar foto' : '+ Subir foto'}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={upload} disabled={busy} />
        </label>
        {picture && !confirming && (
          <button type="button" onClick={() => setConfirming(true)} disabled={busy} className="text-red-600 hover:underline">Borrar</button>
        )}
        {confirming && (
          <span className="flex items-center gap-2 text-xs">
            ¿Borrar la foto?
            <button type="button" onClick={remove} disabled={busy} className="font-medium text-red-600">Sí</button>
            <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="text-gray-500">No</button>
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400">
        La ve el cliente en la página del transportista. Que sea este vehículo, de costado y entero: el cliente calcula el tamaño por la foto.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
