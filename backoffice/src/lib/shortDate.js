// "Sáb 8 nov". La fecha viene con la hora de Lima: se arma con sus números
// para que el huso del navegador no la corra un día.
export function shortDate(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const text = new Date(y, m - 1, d).toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })
  return text.replace(/\./g, '').replace(',', '').replace(/^./, (c) => c.toUpperCase())
}
