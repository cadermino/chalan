// El distrito de una dirección de servicio, para los textos que salen de Chalán
// (nunca la calle). Primero el texto de la dirección, que Google arma como
// "Calle 123, Distrito 15063, Perú": el tramo con el código postal, sin él.
// `neighborhood` puede traer la urbanización ("Fund Oyague" en Jesús María), que
// el formulario de servicios guardaba antes que el distrito; se usa si no hay ese
// tramo (un admin lo escribe a mano). Si tampoco, la ciudad. Mismo criterio que
// district_of en backoffice-api y en la API principal.
const SKIP = /^(per[uú]|lima|callao|provincia de lima)$/i
const POSTAL_CODE = /\b\d{5}\b/

export function districtOf(address) {
  if (!address) return ''
  const parts = (address.street || '').split(',').map((p) => p.trim()).filter(Boolean).slice(1)
  const withZip = parts.find((p) => POSTAL_CODE.test(p))
  const fromZip = withZip ? withZip.replace(POSTAL_CODE, '').trim() : ''
  if (fromZip) return fromZip
  if (address.neighborhood) return address.neighborhood
  const named = parts.reverse().find((p) => !SKIP.test(p) && !/\d/.test(p))
  return named || address.city || ''
}
