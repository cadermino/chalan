// Qué lleva la orden. Una de cada cuatro órdenes que entraban por el formulario
// de mudanza era carga (sacos de arroz, ladrillos, geomembrana, una camioneta),
// y el formulario les pedía la lista de muebles de una casa. Las mismas listas
// viven en el API: app/api/order/load.py.
export const LOAD_TYPES = [
  { value: 'moving', label: 'Mudanza', hint: 'Casa, depto o habitación' },
  { value: 'items', label: 'Objetos sueltos', hint: 'Un mueble, una refri, unas cajas' },
  { value: 'cargo', label: 'Carga o materiales', hint: 'Mercadería, sacos, material de obra' },
  { value: 'vehicle', label: 'Vehículo', hint: 'Auto, camioneta o moto' },
];

// Las órdenes de antes no tienen tipo: eran todas mudanzas.
export const DEFAULT_LOAD_TYPE = 'moving';

// Tramos y no un número libre, como el estacionamiento: nadie sabe cuántos
// kilos lleva. Cada tramo guarda su tope; "más de 10 t" se guarda como 20000.
export const CARGO_WEIGHT_OPTIONS = [
  { value: 500, label: 'Hasta 500 kg' },
  { value: 1500, label: 'Hasta 1,5 toneladas' },
  { value: 3000, label: 'Hasta 3 toneladas' },
  { value: 10000, label: 'Hasta 10 toneladas' },
  { value: 20000, label: 'Más de 10 toneladas' },
];

// Lo que se ve en el inventario del paso 2 según lo que lleva.
export const INVENTORY_COPY = {
  moving: { label: 'Lista las cosas que vamos a mover', placeholder: 'Ej: 1 cama matrimonial' },
  items: { label: 'Lista las cosas que vamos a mover', placeholder: 'Ej: 1 refrigeradora' },
  cargo: { label: 'Describe la carga', placeholder: 'Ej: 200 sacos de arroz de 50 kg' },
  vehicle: { label: 'Describe el vehículo', placeholder: 'Ej: 1 camioneta Toyota Hilux, funciona' },
};

export function needsCargoWeight(loadType) {
  return loadType === 'cargo';
}

export function formatLoadType(value) {
  const option = LOAD_TYPES.find(o => o.value === (value || DEFAULT_LOAD_TYPE));
  return option ? option.label : value;
}

export function formatCargoWeight(value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const option = CARGO_WEIGHT_OPTIONS.find(o => o.value === Number(value));
  return option ? option.label : `${value} kg`;
}
