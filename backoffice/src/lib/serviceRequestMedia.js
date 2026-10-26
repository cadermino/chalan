import axios from 'axios'
import client from '../api/client'

// Espejo de app/api/service_request/validation.py: el servidor es quien manda,
// esto solo evita subir un archivo para enterarse de que no se podía.
export const MAX_MEDIA = 10
const IMAGE_MAX_BYTES = 10 * 1024 * 1024
const VIDEO_MAX_BYTES = 250 * 1024 * 1024
// La foto se achica antes de subir, así que se deja pasar una grande.
const IMAGE_MAX_RAW_BYTES = 30 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
// Algunos navegadores dejan file.type vacío (HEIC, MOV).
const BY_EXTENSION = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
}
export const ACCEPT = [...IMAGE_TYPES, ...VIDEO_TYPES, '.heic', '.mov'].join(',')
// A 2000 px de lado se lee una etiqueta o una grieta, y sube rápido.
const MAX_SIDE = 2000

function contentTypeOf(file) {
  return file.type || BY_EXTENSION[file.name.split('.').pop().toLowerCase()] || ''
}

export const isVideo = (file) => VIDEO_TYPES.includes(contentTypeOf(file))

// Devuelve el texto del problema, o null si el archivo sirve.
export function mediaProblem(file) {
  const type = contentTypeOf(file)
  if (VIDEO_TYPES.includes(type)) return file.size > VIDEO_MAX_BYTES ? 'El video pesa más de 250 MB.' : null
  if (IMAGE_TYPES.includes(type)) return file.size > IMAGE_MAX_RAW_BYTES ? 'La foto pesa más de 30 MB.' : null
  return 'Solo fotos (JPG, PNG, WEBP, HEIC) o videos (MP4, MOV, WEBM).'
}

let nextKey = 0
export function pendingMedia(file) {
  nextKey += 1
  return { key: `media-${nextKey}`, file, preview: isVideo(file) ? null : URL.createObjectURL(file), progress: null, error: null }
}

// Foto → JPEG achicado. Si el navegador no la sabe abrir (HEIC en Chrome), va
// tal cual: el servidor también acepta HEIC.
async function prepare(file) {
  if (isVideo(file)) return file
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

// Firma, sube directo a S3 (sin pasar por el backoffice-api) y registra.
async function uploadMedia(requestId, file, onProgress) {
  const blob = await prepare(file)
  const contentType = blob.type || contentTypeOf(file)
  if (!isVideo(file) && blob.size > IMAGE_MAX_BYTES) throw new Error('La foto pesa más de 10 MB.')
  const base = `/api/service-requests/${requestId}/media`
  const { data: signed } = await client.post(`${base}/presign`, { content_type: contentType, size_bytes: blob.size })
  // axios pelado: sin baseURL ni el token del backoffice, que S3 rechazaría.
  // S3 exige que `file` sea el último campo del formulario.
  const form = new FormData()
  Object.entries(signed.upload.fields).forEach(([name, value]) => form.append(name, value))
  form.append('file', blob)
  await axios.post(signed.upload.url, form, {
    onUploadProgress: (event) => {
      if (event.total) onProgress(Math.round((event.loaded / event.total) * 100))
    },
  })
  const { data } = await client.post(base, { storage_key: signed.storage_key })
  return data
}

// Sube los pendientes de a uno (un video puede pesar cientos de MB). Los que
// suben salen de la cola, así que volver a guardar no los sube dos veces; los
// que fallan se quedan con su error para reintentar.
export async function uploadPendingMedia(requestId, pending, setPending) {
  const update = (key, changes) => setPending((prev) => prev.map((m) => (m.key === key ? { ...m, ...changes } : m)))
  const failed = []
  for (const media of pending) {
    update(media.key, { progress: 0, error: null })
    try {
      // eslint-disable-next-line no-await-in-loop
      await uploadMedia(requestId, media.file, (progress) => update(media.key, { progress }))
      if (media.preview) URL.revokeObjectURL(media.preview)
      setPending((prev) => prev.filter((m) => m.key !== media.key))
    } catch (err) {
      // Sin respuesta: S3 no contestó (la red, o CORS desde el backoffice local).
      const error = err.response?.data?.message
        || (err.response || err.isAxiosError ? 'No se pudo subir. Revisa la conexión y vuelve a guardar.' : err.message)
      update(media.key, { progress: null, error })
      failed.push(media)
    }
  }
  return { failed }
}
