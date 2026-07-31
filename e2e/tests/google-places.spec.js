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

test.describe('Google Places autocomplete', () => {
  test('should fill the address fields from a selected Google Places suggestion', async ({ page }) => {
    await mockGooglePlaces(page);
    await page.goto('/order/step-one', { waitUntil: 'networkidle' });
    await page.waitForSelector('#address-from-street', { timeout: 30000 });

    await selectMockAddress(page, 'address-from-street', FROM_ADDRESS);
    await selectMockAddress(page, 'address-to-street', TO_ADDRESS);

    const stored = await page.evaluate(() => {
      const { orderDetailsOrigin, orderDetailsDestination } = document.querySelector('#app').__vue__.$store.state;
      return {
        fromStreet: orderDetailsOrigin.from_street,
        fromZip: orderDetailsOrigin.from_zip_code,
        fromCountry: orderDetailsOrigin.from_country,
        toStreet: orderDetailsDestination.to_street,
        toZip: orderDetailsDestination.to_zip_code,
        toCountry: orderDetailsDestination.to_country,
      };
    });

    expect(stored.fromStreet).toBe(FROM_ADDRESS.formattedAddress);
    expect(stored.fromZip).toBe(FROM_ADDRESS.zipCode);
    expect(stored.fromCountry).toBe(FROM_ADDRESS.country);
    expect(stored.toStreet).toBe(TO_ADDRESS.formattedAddress);
    expect(stored.toZip).toBe(TO_ADDRESS.zipCode);
    expect(stored.toCountry).toBe(TO_ADDRESS.country);

    // The visible input should reflect the formatted address too, since
    // fillAddress() writes the store value that the field is bound to.
    await expect(page.locator('#address-from-street')).toHaveValue(FROM_ADDRESS.formattedAddress);
    await expect(page.locator('#address-to-street')).toHaveValue(TO_ADDRESS.formattedAddress);
  });

  test('should proceed to step two after picking both addresses from Google', async ({ page }) => {
    await mockGooglePlaces(page);
    await page.goto('/order/step-one', { waitUntil: 'networkidle' });
    await page.waitForSelector('#address-from-street', { timeout: 30000 });

    await selectMockAddress(page, 'address-from-street', FROM_ADDRESS);
    await page.fill('#address-from-interior', '301');
    await page.selectOption('#address-from-floor', { index: 3 });
    await page.fill('#from-parking-distance', '5');
    await page.click('#from-has-elevator-1');

    await selectMockAddress(page, 'address-to-street', TO_ADDRESS);
    await page.fill('#address-to-interior', '102');
    await page.selectOption('#address-to-floor', { index: 2 });
    await page.fill('#to-parking-distance', '10');
    await page.click('#to-has-elevator-0');

    await page.click('button:has-text("Guardar y continuar")');
    await expect(page).toHaveURL(/step-two/, { timeout: 15000 });
  });
});
