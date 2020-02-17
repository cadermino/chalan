export default {
  'step-one': {
    name: 'Dirección recojo/entrega',
    isComplete: false,
    requisites: {
      from_floor_number: null,
      from_street: null,
      from_neighborhood: null,
      from_city: null,
      from_state: null,
      from_zip_code: null,
      to_floor_number: null,
      to_street: null,
      to_neighborhood: null,
      to_city: null,
      to_state: null,
      to_zip_code: null,
    },
  },
  'step-two': {
    name: 'Información del vehículo',
    isComplete: false,
    requisites: {
      driver_id: null,
    },
  },
  'step-three': {
    name: 'Confirmación',
    isComplete: false,
    requisites: {
      appointment_date: null,
    },
  },
  'step-four': {
    name: 'Realiza el pago',
    isComplete: false,
    requisites: {
      customer_id: null,
      payment_id: null,
    },
  },
};
