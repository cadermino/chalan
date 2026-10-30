const { test, expect } = require('@playwright/test');
const { mockGooglePlaces, selectMockAddress, dismissLeadPhoneModalIfPresent } = require('./helpers');

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
      const { orderDetailsOrigin, orderDetailsDestination } = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('main');
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
    await page.selectOption('#address-from-floor', { index: 3 });
    await page.selectOption('#from-parking-distance', '20');
    await page.setChecked('#from-has-elevator-checkbox', true);

    await selectMockAddress(page, 'address-to-street', TO_ADDRESS);
    await page.selectOption('#address-to-floor', { index: 2 });
    await page.selectOption('#to-parking-distance', '50');
    await page.setChecked('#to-has-elevator-checkbox', false);

    await page.click('button:has-text("Guardar y continuar")');
    await dismissLeadPhoneModalIfPresent(page);
    await expect(page).toHaveURL(/step-two/, { timeout: 15000 });
  });

  test('should pin a typed address that was not picked, and go on once the customer sees it', async ({ page }) => {
    await mockGooglePlaces(page);
    // Google finds what was typed. The geocoder of the mock answers nothing,
    // so the area comes from the place's details, as with a key without the
    // Geocoding API.
    await page.addInitScript(() => {
      const { maps } = window.google;
      maps.Map.prototype.setCenter = () => {};
      maps.Map.prototype.setZoom = () => {};
      maps.places.PlacesService.prototype.findPlaceFromQuery = (_opts, cb) => cb([{
        place_id: 'typed-place',
        geometry: { location: { lat: () => -12.07699, lng: () => -77.04857 } },
      }], 'OK');
      maps.places.PlacesService.prototype.getDetails = (_opts, cb) => cb({
        formatted_address: 'Jr. Huiracocha 1460, Jesús María 15072, Perú',
        address_components: [
          { long_name: '15072', short_name: '15072', types: ['postal_code'] },
          { long_name: 'Perú', short_name: 'PE', types: ['country'] },
        ],
      }, 'OK');
    });
    await page.goto('/order/step-one', { waitUntil: 'networkidle' });
    await page.waitForSelector('#address-from-street', { timeout: 30000 });

    await page.fill('#address-from-street', 'Mz B Lt 12, Jesús María');
    await page.selectOption('#address-from-floor', { index: 3 });
    await page.selectOption('#from-parking-distance', '20');
    await page.setChecked('#from-has-elevator-checkbox', true);

    await selectMockAddress(page, 'address-to-street', TO_ADDRESS);
    await page.selectOption('#address-to-floor', { index: 2 });
    await page.selectOption('#to-parking-distance', '50');
    await page.setChecked('#to-has-elevator-checkbox', false);

    await page.click('button:has-text("Guardar y continuar")');
    await expect(page.getByText('Lo ubicamos con lo que escribiste')).toBeVisible();
    await expect(page).toHaveURL(/step-one/);

    const origin = await page.evaluate(() => {
      const { orderDetailsOrigin } = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('main');
      return { ...orderDetailsOrigin };
    });
    // What the customer wrote stays: it is what the carrier reads.
    expect(origin.from_street).toBe('Mz B Lt 12, Jesús María');
    expect(origin.from_country).toBe('Perú');
    expect(origin.from_zip_code).toBe('15072');
    expect(origin.from_map_url).toContain('query=-12.076990,-77.048570');

    await page.click('button:has-text("Guardar y continuar")');
    await dismissLeadPhoneModalIfPresent(page);
    await expect(page).toHaveURL(/step-two/, { timeout: 15000 });
  });
});
