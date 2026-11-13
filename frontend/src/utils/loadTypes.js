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
// `photoHint`: debajo del botón de la foto en el paso 2, para que se entienda
// que con una alcanza y que no es obligatoria.
export const INVENTORY_COPY = {
  moving: { label: 'Lista las cosas que vamos a mover', placeholder: 'Ej: 1 cama matrimonial', photoHint: 'Una foto por ambiente basta.' },
  items: { label: 'Lista las cosas que vamos a mover', placeholder: 'Ej: 1 refrigeradora', photoHint: 'Una foto de lo que vas a mover basta.' },
  cargo: { label: 'Describe la carga', placeholder: 'Ej: 200 sacos de arroz de 50 kg', photoHint: 'Una foto de la carga basta.' },
  vehicle: { label: 'Describe el vehículo', placeholder: 'Ej: 1 camioneta Toyota Hilux, funciona', photoHint: 'Una foto del vehículo basta.' },
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
