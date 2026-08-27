const { test, expect } = require('@playwright/test');
const {
  mockGooglePlaces,
  selectMockAutocompleteAddress,
  dismissLeadPhoneModalIfPresent,
} = require('./helpers');

const FROM_ADDRESS = {
  formattedAddress: 'Av. Javier Prado Este 4600, Santiago de Surco, Lima, Perú',
  zipCode: '15023',
  country: 'Perú',
  mapUrl: 'https://maps.google.com/?q=Av.+Javier+Prado+Este+4600',
  lat: -12.0906,
  lng: -76.9776,
};

const TO_ADDRESS = {
  formattedAddress: 'Av. Arequipa 2450, Lince, Lima, Perú',
  zipCode: '15046',
  country: 'Perú',
  mapUrl: 'https://maps.google.com/?q=Av.+Arequipa+2450',
  lat: -12.0894,
  lng: -77.0328,
};

/**
 * Covers the flow that surfaced the "campos requeridos" elevator bug: a
 * visitor picks an address on the Next.js homepage QuoteWidget, which
 * writes orderDetailsOrigin/orderDetailsDestination straight into
 * localStorage, then clicks through to the Vue order app (a different
 * page/bundle behind the same nginx host) which reads that same
 * localStorage on load. Regressions in that handoff (stale/missing keys
 * from the widget blocking Step One's own required-field check) won't
 * show up in tests that start directly on /order/step-one.
 */
test.describe('Landing QuoteWidget to order flow', () => {
  test('should carry the address from the homepage widget into Step One and let the order proceed', async ({ page }) => {
    await mockGooglePlaces(page);
    await page.goto('/', { waitUntil: 'networkidle' });

    await selectMockAutocompleteAddress(page, '¿Desde dónde?', FROM_ADDRESS);
    await selectMockAutocompleteAddress(page, '¿Hasta dónde?', TO_ADDRESS);

    await expect(page.locator('.price')).toBeVisible({ timeout: 10000 });

    await page.click('a:has-text("Continuar con esta cotización")');
    await expect(page).toHaveURL(/\/order\/step-one/, { timeout: 15000 });

    // The address picked on the widget should already be filled in,
    // carried over via localStorage rather than typed again here.
    await expect(page.locator('#address-from-street')).toHaveValue(FROM_ADDRESS.formattedAddress);
    await expect(page.locator('#address-to-street')).toHaveValue(TO_ADDRESS.formattedAddress);

    // Fill only what the widget couldn't have known. Deliberately leave
    // both elevator checkboxes untouched: the widget writes has_elevator
    // as null, and Step One must not treat that as a missing required
    // field (regression covered here, fixed by removing it from stepOne's
    // requisites in store/steps.js).
    await page.selectOption('#address-from-floor', { index: 1 });
    await page.fill('#from-parking-distance', '5');
    await page.selectOption('#address-to-floor', { index: 1 });
    await page.fill('#to-parking-distance', '10');

    await page.click('button:has-text("Guardar y continuar")');
    await dismissLeadPhoneModalIfPresent(page);
    await expect(page).toHaveURL(/step-two/, { timeout: 15000 });
  });
});
