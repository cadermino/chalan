import axios from 'axios'
import client from '../api/client'

// Espejo de app/api/order_videos.py: el servidor es quien manda, esto solo
// evita subir 250 MB para enterarse de que no se podía.
export const MAX_VIDEOS = 5
const MAX_BYTES = 250 * 1024 * 1024
const CONTENT_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
// Algunos navegadores dejan file.type vacío.
const BY_EXTENSION = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' }

function contentTypeOf(file) {
  if (file.type) return file.type
  return BY_EXTENSION[file.name.split('.').pop().toLowerCase()] || ''
}

// Devuelve el texto del problema, o null si el archivo sirve.
export function videoProblem(file) {
  if (!CONTENT_TYPES.includes(contentTypeOf(file))) return 'Solo videos MP4, MOV o WEBM.'
  if (file.size > MAX_BYTES) return 'El video pesa más de 250 MB.'
  return null
}

let nextKey = 0
export function pendingVideo(file) {
  nextKey += 1
  return { key: `video-${nextKey}`, file, progress: null, error: null }
}

// Firma, sube directo a S3 (sin pasar por el backoffice-api) y registra.
// Devuelve el video ya guardado: {id, url, content_type, ...}.
export async function uploadOrderVideo(orderId, file, onProgress) {
  const { data: signed } = await client.post(`/api/orders/${orderId}/videos/presign`, {
    content_type: contentTypeOf(file),
    size_bytes: file.size,
  })
  // axios pelado: sin baseURL ni el token del backoffice, que S3 rechazaría.
  // S3 exige que `file` sea el último campo del formulario.
  const form = new FormData()
  Object.entries(signed.upload.fields).forEach(([name, value]) => form.append(name, value))
  form.append('file', file)
  await axios.post(signed.upload.url, form, {
    onUploadProgress: (event) => {
      if (event.total) onProgress(Math.round((event.loaded / event.total) * 100))
    },
  })
  const { data: video } = await client.post(`/api/orders/${orderId}/videos`, {
    storage_key: signed.storage_key,
  })
  return video
}

// Sube los pendientes de a uno (cada uno puede pesar cientos de MB). Los que
// suben salen de la cola, así que volver a guardar no los sube dos veces; los
// que fallan se quedan con su error para reintentar.
export async function uploadPendingVideos(orderId, pending, setPending) {
  const update = (key, changes) =>
    setPending(prev => prev.map(v => (v.key === key ? { ...v, ...changes } : v)))
  const uploaded = []
  const failed = []
  for (const video of pending) {
    update(video.key, { progress: 0, error: null })
    try {
      // eslint-disable-next-line no-await-in-loop
      uploaded.push(await uploadOrderVideo(orderId, video.file, progress => update(video.key, { progress })))
      setPending(prev => prev.filter(v => v.key !== video.key))
    } catch (err) {
      const error = err.response?.data?.message || 'No se pudo subir.'
      update(video.key, { progress: null, error })
      failed.push({ ...video, progress: null, error })
    }
  }
  return { uploaded, failed }
}
