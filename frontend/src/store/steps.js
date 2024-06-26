const stepOne = [
  'from_street',
  'from_floor_number',
  'from_zip_code',
  'from_country',
  'from_map_url',
  'from_approximate_distance_from_parking',
  'from_has_elevator',
  'to_street',
  'to_floor_number',
  'to_zip_code',
  'to_country',
  'to_map_url',
  'to_approximate_distance_from_parking',
  'to_has_elevator',
];
const stepTwo = [
  'appointment_date',
  'comments',
  'packaging',
  'cargo',
];
const stepThree = [
  'quotation_id',
];
const stepFour = [
  'payment_method',
];
export default {
  'step-one': {
    name: 'Dirección recojo/entrega',
    previous: null,
    next: 'step-two',
    isComplete: false,
    requisites: stepOne,
  },
  'step-two': {
    name: 'Fecha de mudanza',
    previous: 'step-one',
    next: 'step-three',
    isComplete: false,
    requisites: [...stepOne, ...stepTwo],
  },
  'step-three': {
    name: 'Cotizaciones',
    previous: 'step-two',
    next: 'step-four',
    isComplete: false,
    requisites: [...stepOne, ...stepTwo, ...stepThree],
  },
  'step-four': {
    name: 'Pago',
    previous: 'step-three',
    next: null,
    isComplete: false,
    requisites: [...stepOne, ...stepTwo, ...stepThree, ...stepFour],
  },
};
