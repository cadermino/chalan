// Todas las fechas del formulario son "días" del cliente en Lima, sin hora. Se
// manejan como texto YYYY-MM-DD y nunca pasan por `new Date('YYYY-MM-DD')`, que
// lo interpreta como UTC y en Lima mostraría el día anterior.
const LIMA = 'America/Lima'
export const MAX_ADVANCE_DAYS = 90

export function limaToday() {
  // 'en-CA' formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: LIMA }).format(new Date())
}

export function addDays(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

export function dateLimits() {
  const today = limaToday()
  return { min: addDays(today, 1), max: addDays(today, MAX_ADVANCE_DAYS) }
}

export function isValidPreferredDate(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate || '')) return false
  const { min, max } = dateLimits()
  // YYYY-MM-DD ordena igual como texto que como fecha.
  return isoDate >= min && isoDate <= max
}

export function formatDateLabel(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate || '')) return ''
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('es-PE', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}
