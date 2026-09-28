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

// La distancia al parqueo vale 0 cuando el vehículo entra hasta la puerta, y
// el agente del chat manda ese 0 cuando le contestan eso. Antes el paso
// quedaba incompleto: el cliente veía la casilla con un 0 y el botón muerto,
// sin explicación. El piso también puede llegar en 0 por API, pero no desde
// este formulario —el selector de Perú va de 1 a 20—, así que ese caso se
// cubre en tests/test_orders.py.
test.describe('Step one with zeros', () => {
  async function fillStepOne(page, { distance, floor }) {
    await mockGooglePlaces(page);
    await page.goto('/order/step-one', { waitUntil: 'networkidle' });
    await page.waitForSelector('#address-from-street', { timeout: 30000 });

    await selectMockAddress(page, 'address-from-street', FROM_ADDRESS);
    await selectMockAddress(page, 'address-to-street', TO_ADDRESS);

    await page.selectOption('#address-from-floor', String(floor));
    await page.selectOption('#address-to-floor', String(floor));
    await page.fill('#from-parking-distance', String(distance));
    await page.fill('#to-parking-distance', String(distance));
    await page.locator('#to-parking-distance').blur();
  }

  const isStepOneComplete = (page) => page.evaluate(
    () => document.querySelector('#app').__vue__.$store.state.steps['step-one'].isComplete,
  );

  test('a parking distance of 0 completes the step', async ({ page }) => {
    await fillStepOne(page, { distance: 0, floor: 3 });

    expect(await isStepOneComplete(page)).toBe(true);
  });

  test('a 0 is not flagged as a missing field when submitting', async ({ page }) => {
    // nextStep() valida y después avanza. Con la validación vieja el campo se
    // pintaba en rojo y salía el cartel de campos faltantes aunque el paso
    // siguiera adelante: te avisaba que faltaba algo y te dejaba pasar igual.
    await fillStepOne(page, { distance: 0, floor: 3 });
    await page.getByRole('button', { name: 'Guardar y continuar' }).click();

    await expect(page.locator('#from-parking-distance')).not.toHaveClass(/border-red-300/);
    await expect(page.getByText('no olvides llenar este campo')).toHaveCount(0);
  });

  test('an empty distance still leaves the step incomplete', async ({ page }) => {
    // El arreglo distingue el cero del vacío; no afloja la validación.
    await fillStepOne(page, { distance: 5, floor: 3 });
    await page.fill('#from-parking-distance', '');
    await page.locator('#from-parking-distance').blur();

    expect(await isStepOneComplete(page)).toBe(false);
  });
});
