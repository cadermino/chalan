// RUC peruano: 11 dígitos, prefijo de tipo de contribuyente y dígito
// verificador. La misma cuenta que app/api/formal_quotation/ruc.py y
// frontend/src/utils/ruc.js: cambiarlos juntos.
const PREFIXES = ['10', '15', '16', '17', '20']
const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

export function normalizeRuc(value) {
  return String(value || '').replace(/\s+/g, '')
}

export function isValidRuc(value) {
  const ruc = normalizeRuc(value)
  if (!/^\d{11}$/.test(ruc) || !PREFIXES.includes(ruc.slice(0, 2))) return false
  const total = WEIGHTS.reduce((sum, weight, i) => sum + Number(ruc[i]) * weight, 0)
  let check = 11 - (total % 11)
  if (check === 10) check = 0
  if (check === 11) check = 1
  return check === Number(ruc[10])
}
