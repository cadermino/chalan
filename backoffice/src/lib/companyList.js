// Lógica de la lista de empresas transportistas, aparte de la pantalla para poder
// probarla sin navegador. Todo se hace en el cliente: el API devuelve todas las
// empresas de una vez (decenas, no miles).

// "Ñandú  Pack" -> "nandu pack": sin tildes, sin mayúsculas, espacios colapsados.
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// ¿La empresa hace mudanzas? Lo mismo que decide el API principal al avisar un pedido:
// activa y con país. Por eso no sale una etiqueta "Mudanza" en una empresa inactiva.
export function offersMoves(company) {
  return Boolean(company.active && company.country_id)
}

// Todo lo que se puede buscar de una empresa, ya normalizado. El usuario cuenta: una
// empresa registrada desde la landing nace con el nombre de quien la registró, así que
// muchas veces se la encuentra por el nombre o email del usuario y no por el de la empresa.
export function searchableText(company) {
  const parts = [
    company.id,
    company.name,
    company.email,
    company.phone,
    company.rfc,
    ...(company.users || []).flatMap((u) => [u.name, u.email]),
    ...(company.service_types || []).map((t) => t.name),
    offersMoves(company) ? 'mudanza' : '',
  ]
  return normalize(parts.filter((p) => p !== null && p !== undefined).join(' '))
}

// Todas las palabras escritas tienen que aparecer (en cualquier orden): "embala lima" encuentra
// "Lima Embala". Una búsqueda vacía no filtra nada.
export function matchesSearch(company, query) {
  const words = normalize(query).split(' ').filter(Boolean)
  if (words.length === 0) return true
  const haystack = searchableText(company)
  return words.every((word) => haystack.includes(word))
}

const byName = (a, b) =>
  String(a.name ?? '').localeCompare(String(b.name ?? ''), 'es', { sensitivity: 'base', numeric: true })

const COMPARATORS = {
  id: (a, b) => a.id - b.id,
  name: byName,
  // "Ascendente" pone primero las activas: es lo que se espera al ordenar por estado
  // por primera vez, y la inversa deja las inactivas arriba.
  status: (a, b) => Number(Boolean(b.active)) - Number(Boolean(a.active)),
}

// Devuelve una copia ordenada. Desempata siempre por nombre y luego por id, para que el
// orden sea estable y no salte al recargar.
export function sortCompanies(companies, key, direction) {
  const compare = COMPARATORS[key] || byName
  const sign = direction === 'desc' ? -1 : 1
  return [...companies].sort((a, b) => sign * compare(a, b) || byName(a, b) || a.id - b.id)
}
