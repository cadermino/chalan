const { test, expect } = require('@playwright/test');
const { mockGooglePlaces, selectMockAddress } = require('./helpers');

const FROM_ADDRESS = {
  formattedAddress: 'Av. Javier Prado Este 4600, Santiago de Surco, Lima, Perú',
  zipCode: '15023',
  country: 'Perú',
  mapUrl: 'https://maps.google.com/?q=Av.+Javier+Prado+Este+4600',
};

const TO_ADDRESS = {
  formattedAddress: 'Av. Arequipa 2450, Lince, Lima, Perú',
  zipCode: '15046',
  country: 'Perú',
  mapUrl: 'https://maps.google.com/?q=Av.+Arequipa+2450',
};

// La distancia al parqueo vale 0 cuando el camión se estaciona en la puerta.
// Es el tramo que viene elegido ("En la puerta"), así que si el 0 volviera a
// contar como vacío no avanzaría ninguna orden: antes el paso quedaba
// incompleto, con el botón muerto y sin explicación. El piso también puede
// llegar en 0 por API, pero no desde este formulario —el selector de Perú va
// de sótano 3 a 20, sin planta baja—, así que ese caso se cubre en
// tests/test_orders.py.
test.describe('Step one with zeros', () => {
  async function fillStepOne(page, { distance, floor }) {
    await mockGooglePlaces(page);
    await page.goto('/order/step-one', { waitUntil: 'networkidle' });
    await page.waitForSelector('#address-from-street', { timeout: 30000 });

    await selectMockAddress(page, 'address-from-street', FROM_ADDRESS);
    await selectMockAddress(page, 'address-to-street', TO_ADDRESS);

    await page.selectOption('#address-from-floor', String(floor));
    await page.selectOption('#address-to-floor', String(floor));
    await page.selectOption('#from-parking-distance', String(distance));
    await page.selectOption('#to-parking-distance', String(distance));
    await page.locator('#to-parking-distance').blur();
  }

  const isStepOneComplete = (page) => page.evaluate(
    () => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('main').steps['step-one'].isComplete,
  );

  test('a parking distance of 0 completes the step and is not flagged on submit', async ({ page }) => {
    await fillStepOne(page, { distance: 0, floor: 3 });

    expect(await isStepOneComplete(page)).toBe(true);

    // nextStep() valida y después avanza. Con la validación vieja el campo se
    // pintaba en rojo y salía el cartel de campos faltantes aunque el paso
    // siguiera adelante: te avisaba que faltaba algo y te dejaba pasar igual.
    await page.getByRole('button', { name: 'Guardar y continuar' }).click();

    await expect(page.locator('#from-parking-distance')).not.toHaveClass(/border-red-300/);
    await expect(page.getByText('no olvides llenar este campo')).toHaveCount(0);
  });

  test('the distance starts at "En la puerta", so it never blocks the step', async ({ page }) => {
    // Ya no es un número libre (era el campo que más frenaba el paso 1): son
    // tramos y el primero viene elegido. Cero es "en la puerta".
    await mockGooglePlaces(page);
    await page.goto('/order/step-one', { waitUntil: 'networkidle' });
    await page.waitForSelector('#address-from-street', { timeout: 30000 });

    await expect(page.locator('#from-parking-distance')).toHaveValue('0');
    await expect(page.locator('#to-parking-distance')).toHaveValue('0');
    await expect(page.locator('#from-parking-distance option:checked')).toHaveText('En la puerta');
  });
});
