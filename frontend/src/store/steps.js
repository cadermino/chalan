export default {
  'step-one': {
    name: 'Dirección recojo/entrega',
    previous: null,
    isComplete: false,
    requisites: [
      'from_floor_number',
      'from_street',
      'from_neighborhood',
      'from_city',
      'from_state',
      'from_zip_code',
      'to_floor_number',
      'to_street',
      'to_neighborhood',
      'to_city',
      'to_state',
      'to_zip_code',
    ],
  },
  'step-two': {
    name: 'Información del vehículo',
    previous: 'step-one',
    isComplete: false,
    requisites: [
      'product_id',
      'price',
    ],
  },
  'step-three': {
    name: 'Agenda',
    previous: 'step-two',
    isComplete: false,
    requisites: [
      'appointment_date',
    ],
  },
  'step-four': {
    name: 'Pago',
    previous: 'step-three',
    isComplete: false,
    requisites: [
      'payment_id',
      'customer_id',
      'token',
    ],
  },
};
