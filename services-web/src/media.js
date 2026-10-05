// Espejo de app/api/service_request/validation.py: el servidor es quien manda,
// esto solo evita subir 100 MB para enterarse de que no se podía.
export const MAX_MEDIA = 10
const MB = 1024 * 1024

const TYPES = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/heic': 'image',
  'image/heif': 'image',
  'video/mp4': 'video',
  'video/quicktime': 'video',
  'video/webm': 'video',
}
const MAX_BYTES = { image: 10 * MB, video: 100 * MB }

// Algunos navegadores (y los HEIC del iPhone en varios casos) dejan file.type vacío.
const BY_EXTENSION = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
}

export function contentTypeOf(file) {
  if (file.type) return file.type
  const extension = file.name.split('.').pop().toLowerCase()
  return BY_EXTENSION[extension] || ''
}

// Devuelve el texto del problema, o null si el archivo sirve.
export function problemWith(file) {
  const kind = TYPES[contentTypeOf(file)]
  if (!kind) return 'Solo se aceptan fotos (JPG, PNG, WEBP, HEIC) y videos (MP4, MOV, WEBM).'
  if (file.size > MAX_BYTES[kind]) {
    return kind === 'image' ? 'La foto pesa más de 10 MB.' : 'El video pesa más de 100 MB.'
  }
  return null
}
