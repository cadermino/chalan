// El distrito de una dirección de servicio, para los textos que salen de Chalán
// (nunca la calle). `neighborhood` lo llena el formulario con el de Google; si
// vino vacío, se saca del texto de la dirección, que Google arma como
// "Calle 123, Distrito 15063, Perú": el tramo con el código postal, sin él. Si
// tampoco está, la ciudad. Mismo criterio que district_of en backoffice-api.
const SKIP = /^(per[uú]|lima|callao|provincia de lima)$/i

export function districtOf(address) {
  if (!address) return ''
  if (address.neighborhood) return address.neighborhood
  const parts = (address.street || '').split(',').map((p) => p.trim()).filter(Boolean)
  const withZip = parts.slice(1).find((p) => /\b\d{5}\b/.test(p))
  if (withZip) return withZip.replace(/\b\d{5}\b/, '').trim()
  const named = parts.slice(1).reverse().find((p) => !SKIP.test(p) && !/\d/.test(p))
  return named || address.city || ''
}
