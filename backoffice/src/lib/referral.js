// El link que una inmobiliaria comparte: cualquier página del sitio con ?ref=
// (Vue y Next.js guardan el código en la cookie chalan_ref).
const SITE_URL = import.meta.env.VITE_SITE_URL || window.location.origin

export function referralLink(code) {
  return code ? `${SITE_URL}/?ref=${code}` : null
}
