const arrayFromCeroToNineteen = [...Array(20).keys()];
const objectFromOneToTweenty = {};
arrayFromCeroToNineteen
  .forEach((index) => { objectFromOneToTweenty[index + 1] = index + 1; });

export default {
  peru: {
    general: {
      phone: '51972643007',
      currency: 'PEN',
    },
    'step-one': {
      fromStreetPlaceholder: 'Ejem: Calle Londres 198 Perú',
      toStreetPlaceholder: 'Ejem: Calle Londres 198 Perú',
      floor: objectFromOneToTweenty,
    },
    'step-three': {
      currency: 'PEN',
    },
    'step-four': {
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
      floor: { ...arrayFromCeroToNineteen, 0: 'Planta baja' },
    },
    'step-three': {
      currency: 'MXN',
    },
    'step-four': {
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
