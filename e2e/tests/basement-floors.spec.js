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

test.describe('Basement floors', () => {
  test.beforeEach(async ({ page }) => {
    await mockGooglePlaces(page);
    await page.goto('/order/step-one', { waitUntil: 'networkidle' });
    await page.waitForSelector('#address-from-street', { timeout: 30000 });
  });

  test('the basements come first and in order', async ({ page }) => {
    // El orden importa: como objeto, las claves negativas quedaban al final y
    // desordenadas, así que "Sótano 1" aparecía después del piso 20.
    const labels = await page.locator('#address-from-floor option').allTextContents();

    expect(labels.map(l => l.trim()).slice(0, 5))
      .toEqual(['Selecciona un piso', 'Sótano 3', 'Sótano 2', 'Sótano 1', '1']);
  });

  test('picking a basement stores a negative floor and completes the step', async ({ page }) => {
    await selectMockAddress(page, 'address-from-street', FROM_ADDRESS);
    await selectMockAddress(page, 'address-to-street', TO_ADDRESS);

    await page.selectOption('#address-from-floor', '-3');
    await page.selectOption('#address-to-floor', '2');
    await page.fill('#from-parking-distance', '5');
    await page.fill('#to-parking-distance', '5');
    await page.locator('#to-parking-distance').blur();

    const state = await page.evaluate(() => {
      const store = document.querySelector('#app').__vue__.$store.state;
      return {
        from: store.orderDetailsOrigin.from_floor_number,
        isComplete: store.steps['step-one'].isComplete,
      };
    });

    expect(state.from).toBe(-3);
    expect(state.isComplete).toBe(true);
  });

  test('the basement is what gets sent to the server', async ({ page }) => {
    await selectMockAddress(page, 'address-from-street', FROM_ADDRESS);
    await selectMockAddress(page, 'address-to-street', TO_ADDRESS);
    await page.selectOption('#address-from-floor', '-2');
    await page.selectOption('#address-to-floor', '1');
    await page.fill('#from-parking-distance', '5');
    await page.fill('#to-parking-distance', '5');
    await page.locator('#to-parking-distance').blur();

    const [request] = await Promise.all([
      page.waitForRequest(r => r.url().includes('/api/v1/order') && r.method() === 'POST'),
      page.getByRole('button', { name: 'Guardar y continuar' }).click(),
    ]);

    const sent = JSON.parse(request.postData());
    expect(sent.orderDetailsOrigin.from_floor_number).toBe(-2);
    expect(sent.orderDetailsDestination.to_floor_number).toBe(1);
  });
});
