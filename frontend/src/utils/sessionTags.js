// Etiqueta la grabación de Inspectlet con los ids internos de la orden y del
// cliente, para poder encontrar la sesión de alguien que llama a soporte: se
// lo busca por teléfono en el backoffice, se ve el número de orden y con eso
// se filtra en Inspectlet.
//
// Solo ids, nunca teléfono, email ni nombre: sin la base de Chalán un id no
// dice quién es la persona, y así ninguna grabación queda ligada a datos
// personales en un proveedor externo. Misma regla que utils/analytics.js.
//
// Inspectlet solo se carga en producción (public/index.html), así que en local
// `window.__insp` no existe y esto no hace nada.

const lastTagged = {};

// La cola que crea el snippet de Inspectlet. El nombre con guiones bajos es
// suyo, no nuestro; se lee en un solo lugar para no esparcir el nombre.
const INSPECTLET_QUEUE = '__insp';

function inspectletQueue() {
  if (typeof window === 'undefined') return null;
  const queue = window[INSPECTLET_QUEUE];
  return queue && typeof queue.push === 'function' ? queue : null;
}

export function tagSession(key, value) {
  if (value === null || value === undefined || value === '') return;
  const queue = inspectletQueue();
  if (!queue) return;
  // La orden y el cliente se vuelven a escribir en el store a cada recarga
  // (se restauran del localStorage) y en cada paso: sin esto se mandaría la
  // misma etiqueta decenas de veces por sesión.
  if (lastTagged[key] === value) return;
  lastTagged[key] = value;
  queue.push(['tagSession', { [key]: value }]);
}

const sentLabels = new Set();

// Etiqueta suelta, sin valor. A diferencia de clave/valor, varias se acumulan
// en la misma sesión: sirve para marcar cosas que pueden pasar más de una vez
// con distinto detalle, como trabarse primero en un campo y después en otro.
export function tagSessionLabel(label) {
  if (!label || sentLabels.has(label)) return;
  const queue = inspectletQueue();
  if (!queue) return;
  sentLabels.add(label);
  queue.push(['tagSession', label]);
}

// Gemelo en Inspectlet de los eventos step_one_blocked / step_two_blocked de
// GA4: GA4 dice cuántos se traban y en qué campo, esto deja encontrar esas
// grabaciones para ver qué hicieron antes. Trabarse no cambia la URL, así
// que sin la etiqueta no hay forma de filtrarlas. Nombre del campo, nunca
// su valor.
export function tagBlockedStep(step, field) {
  if (field) tagSessionLabel(`${step}_blocked:${field}`);
}

// Plugin de Vuex: escucha las mutaciones en vez de llamar a tagSession desde
// cada componente. La orden y el cliente se asignan desde muchos lugares
// (crear orden, login con email, Google o Facebook, restaurar del
// localStorage), pero todos pasan por estas dos mutaciones.
export function sessionTagsPlugin(store) {
  store.subscribe(({ type, payload }) => {
    if (!payload) return;
    if (type === 'setOrder' && payload.section === 'currentOrder' && payload.field === 'order_id') {
      tagSession('order_id', payload.value);
    }
    if (type === 'setCustomerData' && payload.field === 'customer_id') {
      tagSession('customer_id', payload.value);
    }
  });
}
