import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// El catálogo casi no cambia: se pide una vez por servicio y se comparte entre
// pantallas. Si falla no se guarda, para que reintentar vuelva a pedirlo.
const materialsCache = {}

export function getMaterials(service) {
  if (!materialsCache[service]) {
    materialsCache[service] = client
      .get(`/service-types/${service}/materials`)
      .then((res) => res.data)
      .catch((err) => {
        delete materialsCache[service]
        throw err
      })
  }
  return materialsCache[service]
}

export const createRequest = (payload) =>
  client.post('/service-requests', payload).then((res) => res.data)

export const getRequest = (publicId) =>
  client.get(`/service-requests/${publicId}`).then((res) => res.data)

export const updateRequest = (publicId, payload) =>
  client.patch(`/service-requests/${publicId}`, payload).then((res) => res.data)

export const submitRequest = (publicId, payload) =>
  client.post(`/service-requests/${publicId}/submit`, payload).then((res) => res.data)

export const presignMedia = (publicId, file) =>
  client.post(`/service-requests/${publicId}/media/presign`, file).then((res) => res.data)

export const registerMedia = (publicId, storageKey) =>
  client
    .post(`/service-requests/${publicId}/media`, { storage_key: storageKey })
    .then((res) => res.data)

export const deleteMedia = (publicId, mediaId) =>
  client.delete(`/service-requests/${publicId}/media/${mediaId}`)

// Directo a S3, sin pasar por nuestra API (un video de 100 MB bloquearía un
// worker). Va con axios pelado: sin baseURL ni el Content-Type JSON del cliente.
// S3 exige que `file` sea el último campo del formulario.
export function uploadToStorage(upload, file, onProgress) {
  const form = new FormData()
  Object.entries(upload.fields).forEach(([name, value]) => form.append(name, value))
  form.append('file', file)
  return axios.post(upload.url, form, {
    onUploadProgress: (event) => {
      if (event.total) onProgress(Math.round((event.loaded / event.total) * 100))
    },
  })
}

// El backend responde {message} en inglés, pensado para quien programa; al
// cliente se le dice algo que pueda hacer.
export function friendlyError(err, fallback) {
  const message = err?.response?.data?.message || ''
  if (!err?.response) return 'No hay conexión. Revisa tu internet e inténtalo de nuevo.'
  if (message.includes('preferred_date')) {
    return 'Elige una fecha válida: desde mañana y hasta dentro de 90 días.'
  }
  if (message.includes('whatsapp')) return 'Revisa tu número de WhatsApp.'
  if (message.includes('item')) return 'Agrega al menos una cosa para embalar.'
  if (message.includes('address')) return 'Revisa la dirección: elígela de la lista de sugerencias.'
  return fallback
}
