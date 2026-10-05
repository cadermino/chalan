// Mismo número que usa la landing (/embalaje-profesional).
export const WHATSAPP_NUMBER = '51972643007'

export function whatsappUrl(text) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

export const SERVICE = 'packing'
export const BASE_PATH = '/embalaje/cotizar'
export const PATHS = {
  address: `${BASE_PATH}/direccion`,
  items: `${BASE_PATH}/que-embalamos`,
  contact: `${BASE_PATH}/fecha-y-contacto`,
  sent: `${BASE_PATH}/enviado`,
}
export const PLACES_API_KEY = import.meta.env.VITE_PLACES_API_KEY
