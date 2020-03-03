export default {
  'step-one': {
    name: 'Dirección recojo/entrega',
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
    isComplete: false,
    requisites: [
      'driver_id',
    ],
  },
  'step-three': {
    name: 'Confirmación',
    isComplete: false,
    requisites: [
      'appointment_date',
    ],
  },
  'step-four': {
    name: 'Realiza el pago',
    isComplete: false,
    requisites: [
      'customer_id',
      'payment_id',
    ],
  },
};
