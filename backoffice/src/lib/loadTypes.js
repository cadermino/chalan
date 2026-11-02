// Mismas listas que frontend/src/utils/loadTypes.js. Sin tipo = orden de
// antes de la migración 030, todas eran mudanzas.
const LOAD_TYPE_LABELS = { moving: 'Mudanza', items: 'Objetos sueltos', cargo: 'Carga o materiales', vehicle: 'Vehículo' }
export const loadTypeLabel = (value) => LOAD_TYPE_LABELS[value || 'moving'] || value
const CARGO_WEIGHT_LABELS = { 500: 'Hasta 500 kg', 1500: 'Hasta 1,5 t', 3000: 'Hasta 3 t', 10000: 'Hasta 10 t', 20000: 'Más de 10 t' }
export const cargoWeightLabel = (kg) => (kg ? CARGO_WEIGHT_LABELS[kg] || `${kg} kg` : null)
