// El distrito de una dirección de servicio, para los textos que salen de Chalán
// (nunca la calle). Primero el texto de la dirección, que Google arma como
// "Calle 123, Distrito 15063, Perú": el tramo con el código postal, sin él.
// `neighborhood` puede traer la urbanización ("Fund Oyague" en Jesús María), que
// el formulario de servicios guardaba antes que el distrito; se usa si no hay ese
// tramo (un admin lo escribe a mano). Si tampoco, la ciudad. "Lima" o "Callao" solo
// si no hay nada más: Google también escribe "Calle 123, Los Olivos, Lima 15301",
// con la provincia junto al código postal. El primer tramo (la calle) solo cuenta
// si es un distrito. Mismo criterio que
// district_of en backoffice-api y en la API principal.
const SKIP = /^(per[uú]|lima|callao|provincia de lima)$/i
const POSTAL_CODE = /\b\d{5}\b/
// Los distritos de Lima y Callao: el primer tramo de la dirección es la calle,
// salvo cuando el cliente eligió el distrito mismo ("Los Olivos, Lima 15063").
const LIMA_DISTRICTS = new Set([
  'cercado de lima', 'lince', 'jesus maria', 'pueblo libre', 'magdalena', 'magdalena del mar', 'san miguel',
  'san isidro', 'miraflores', 'barranco', 'surquillo', 'san borja', 'surco', 'santiago de surco', 'la molina',
  'ate', 'santa anita', 'el agustino', 'la victoria', 'brena', 'rimac', 'san martin de porres', 'los olivos',
  'independencia', 'comas', 'carabayllo', 'puente piedra', 'ancon', 'santa rosa', 'san juan de lurigancho',
  'lurigancho', 'chaclacayo', 'cieneguilla', 'san juan de miraflores', 'villa maria del triunfo',
  'villa el salvador', 'chorrillos', 'san luis', 'pachacamac', 'lurin', 'punta hermosa', 'punta negra',
  'san bartolo', 'pucusana', 'bellavista', 'la perla', 'carmen de la legua', 'carmen de la legua reynoso',
  'ventanilla', 'la punta', 'mi peru',
])
const plain = (text) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export function districtOf(address) {
  if (!address) return ''
  const [first = '', ...parts] = (address.street || '').split(',').map((p) => p.trim()).filter(Boolean)
  const withZip = parts.find((p) => POSTAL_CODE.test(p))
  const fromZip = withZip ? withZip.replace(POSTAL_CODE, '').trim() : ''
  const named = [...parts].reverse().find((p) => !SKIP.test(p) && !/\d/.test(p))
  const picked = LIMA_DISTRICTS.has(plain(first)) ? first : null
  const found = [fromZip, address.neighborhood, named, picked, address.city].filter(Boolean)
  return found.find((d) => !SKIP.test(d)) || found[0] || ''
}
