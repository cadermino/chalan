export default {
  'step-one': {
    name: 'Dirección recojo/entrega',
    previous: null,
    next: 'step-two',
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
    name: 'Fecha de mudanza',
    previous: 'step-one',
    next: 'step-three',
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
      'appointment_date',
    ],
  },
  'step-three': {
    name: 'Información del vehículo',
    previous: 'step-two',
    next: 'step-four',
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
      'appointment_date',
      'vehicle_id',
      'vehicle_size',
      'price',
    ],
  },
  'step-four': {
    name: 'Pago',
    previous: 'step-three',
    next: null,
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
      'appointment_date',
      'vehicle_id',
      'vehicle_size',
      'price',
      'payment_method',
      'product_id',
    ],
  },
};
