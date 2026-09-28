// Lista y no objeto: con claves negativas, JavaScript itera primero las
// enteras no negativas y deja las negativas para el final, en orden de
// inserción, así que los sótanos salían abajo de todo y desordenados. Una
// lista se recorre como está escrita.
const floorOption = (value, label = String(value)) => ({ value, label });

// Tres sótanos alcanzan para los edificios residenciales de Lima. Bajar
// muebles desde un sótano cuesta el mismo trabajo que subirlos, así que el
// transportista necesita saberlo para cotizar.
const basements = [3, 2, 1].map(level => floorOption(-level, `Sótano ${level}`));
const floorsFromOneToTwenty = [...Array(20).keys()].map(index => floorOption(index + 1));
const floorsFromCeroToNineteen = [
  floorOption(0, 'Planta baja'),
  ...[...Array(19).keys()].map(index => floorOption(index + 1)),
];

export default {
  peru: {
    general: {
      phone: '51972643007',
      currency: 'PEN',
    },
    'step-one': {
      fromStreetPlaceholder: 'Ejem: Calle Londres 198 Perú',
      toStreetPlaceholder: 'Ejem: Calle Londres 198 Perú',
      floor: [...basements, ...floorsFromOneToTwenty],
    },
    'step-three': {
      currency: 'PEN',
    },
    dashboard: {
      currency: 'PEN',
    },
    'carrier-company': {
      currency: 'PEN',
      phone: '51972643007',
    },
  },
  mexico: {
    general: {
      phone: '525621458596',
      currency: 'MXN',
    },
    'step-one': {
      fromStreetPlaceholder: 'Ejem: Calle Londres 198 México',
      toStreetPlaceholder: 'Ejem: Calle Londres 198 México',
      floor: floorsFromCeroToNineteen,
    },
    'step-three': {
      currency: 'MXN',
    },
    dashboard: {
      currency: 'MXN',
    },
    'carrier-company': {
      currency: 'PEN',
      phone: '51972643007',
    },
  },
};
