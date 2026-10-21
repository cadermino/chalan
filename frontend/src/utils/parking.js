// Distancia del estacionamiento a la puerta. Era un número libre en metros y
// fue el campo que más frenaba el paso 1 en GA4 (step_one_blocked): nadie sabe
// cuántos metros hay. Ahora son tramos, con "en la puerta" de entrada. La
// columna sigue siendo un entero en metros; cada tramo guarda su tope, y el
// transportista lee el tramo, no el número.
export const PARKING_OPTIONS = [
  { value: 0, label: 'En la puerta' },
  { value: 20, label: 'A menos de 20 m' },
  { value: 50, label: 'Entre 20 y 50 m' },
  { value: 100, label: 'A más de 50 m' },
];

export const DEFAULT_PARKING_DISTANCE = 0;

export function formatParkingDistance(value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const meters = Number(value);
  const option = PARKING_OPTIONS.find(o => o.value === meters);
  // Órdenes de antes de los tramos: el número que escribió el cliente.
  return option ? option.label : `${value} m`;
}
