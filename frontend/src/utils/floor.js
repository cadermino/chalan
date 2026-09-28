// Cómo se lee un piso. Vive acá y no en cada vista para que el transportista
// vea exactamente la misma etiqueta que el cliente eligió en el formulario: si
// el cliente marcó "Sótano 3", quien va a cotizar no debería leer "-3" y tener
// que deducir qué significa el signo.
export default function formatFloor(value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const floor = Number(value);
  if (Number.isNaN(floor)) {
    return String(value);
  }
  if (floor < 0) {
    return `Sótano ${Math.abs(floor)}`;
  }
  if (floor === 0) {
    return 'Planta baja';
  }
  return String(floor);
}
