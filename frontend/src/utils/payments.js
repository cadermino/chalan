// Lectura de las filas de `payments` desde las vistas del transportista.
//
// Desde la migración 016 una orden tiene una fila por movimiento de plata: la
// reserva que el cliente le yapea a Chalán (su comisión más la del agente si la
// orden viene referida) y el efectivo que le entrega al transportista. Antes
// había una sola fila con el bruto, marcada 'order_total' — esas siguen vivas y
// hay que seguir mostrándolas bien.

function byConcept(payments, concept) {
  if (!Array.isArray(payments)) return null;
  // De atrás hacia adelante: si por algún reproceso quedaran dos filas del
  // mismo concepto, vale la última.
  for (let i = payments.length - 1; i >= 0; i -= 1) {
    if (payments[i] && payments[i].concept === concept) return payments[i];
  }
  return null;
}

// El movimiento que representa el pago del servicio. Es el que alimenta el
// estado que ve el transportista.
export function servicePayment(payments) {
  if (!Array.isArray(payments) || payments.length === 0) return null;
  return byConcept(payments, 'carrier_cash')
    || byConcept(payments, 'order_total')
    || payments[payments.length - 1];
}

// Cuánto efectivo le toca cobrar al transportista el día de la mudanza.
//
// Si la reserva ya está pagada, cobra solo su precio; si sigue pendiente, cobra
// también esa parte y queda debiéndole la comisión a Chalán, que es como
// funcionaba antes de existir la reserva. En órdenes anteriores a 016 no hay
// fila de reserva y se devuelve el bruto de siempre.
export function cashToCollect(payments) {
  const service = servicePayment(payments);
  if (!service) return null;

  const reservation = byConcept(payments, 'reservation');
  const pendingReservation = reservation && reservation.status !== 'paid'
    ? Number(reservation.amount) || 0
    : 0;

  return Math.round((Number(service.amount) + pendingReservation) * 100) / 100;
}

export default { servicePayment, cashToCollect };
