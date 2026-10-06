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

// ---------------------------------------------------------------------------------------
// Filtros y estado de la lista (se guarda en la URL, así sobrevive a recargar y a volver
// atrás desde "Editar").

export const SORT_KEYS = ['id', 'name', 'status']
export const STATUS_FILTERS = ['all', 'active', 'inactive']
// En la URL y en el filtro, la mudanza se llama 'moves': no es un tipo de servicio del
// catálogo sino una condición de la empresa (activa y con país).
export const MOVES = 'moves'

export const DEFAULT_LIST_STATE = { q: '', sort: 'name', dir: 'asc', status: 'all', service: '', pending: false }

// Una cuenta que se registró desde la landing queda inactiva hasta que un admin la aprueba;
// la empresa con alguna cuenta así está esperando aprobación.
export function isPendingApproval(company) {
  return (company.users || []).some((u) => !u.active)
}

export function hasService(company, code) {
  if (code === MOVES) return offersMoves(company)
  return (company.service_types || []).some((t) => t.code === code)
}

// Lo que se puede elegir en el filtro de servicio: la mudanza y los tipos que alguna empresa
// ofrece de verdad (uno que nadie hace solo daría una lista vacía).
export function serviceOptions(companies) {
  const types = new Map()
  companies.forEach((c) => (c.service_types || []).forEach((t) => types.set(t.code, t.name)))
  return [
    { code: MOVES, name: 'Mudanza' },
    ...[...types.entries()]
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
  ]
}

export function filterCompanies(companies, { q, status, service, pending }, pinnedId = null) {
  return companies.filter((c) => {
    // La fila que se está editando no desaparece aunque el cambio la saque del filtro.
    if (pinnedId !== null && c.id === pinnedId) return true
    if (status === 'active' && !c.active) return false
    if (status === 'inactive' && c.active) return false
    if (service && !hasService(c, service)) return false
    if (pending && !isPendingApproval(c)) return false
    return matchesSearch(c, q)
  })
}

// URLSearchParams -> estado. Lo que no reconoce (un link viejo, un valor a mano) cae al
// valor por defecto en vez de romper la pantalla.
export function parseListState(params) {
  const sort = params.get('sort')
  const dir = params.get('dir')
  const status = params.get('status')
  return {
    q: params.get('q') || '',
    sort: SORT_KEYS.includes(sort) ? sort : DEFAULT_LIST_STATE.sort,
    dir: dir === 'desc' ? 'desc' : 'asc',
    status: STATUS_FILTERS.includes(status) ? status : 'all',
    service: params.get('service') || '',
    pending: params.get('pending') === '1',
  }
}

// Estado -> URLSearchParams, sin escribir lo que ya es el valor por defecto: la URL de
// una lista sin tocar queda limpia.
export function serializeListState(state) {
  const params = new URLSearchParams()
  const d = DEFAULT_LIST_STATE
  if (state.q) params.set('q', state.q)
  if (state.sort !== d.sort) params.set('sort', state.sort)
  if (state.dir !== d.dir) params.set('dir', state.dir)
  if (state.status !== d.status) params.set('status', state.status)
  if (state.service) params.set('service', state.service)
  if (state.pending) params.set('pending', '1')
  return params
}

// ¿Hay algo filtrando (sin contar el orden)?
export function hasActiveFilters(state) {
  return Boolean(state.q.trim()) || state.status !== 'all' || Boolean(state.service) || state.pending
}
