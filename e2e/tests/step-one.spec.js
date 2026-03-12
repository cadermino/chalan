const { test, expect } = require('@playwright/test');

const TEST_DATA = {
  from: {
    street: 'Av. Javier Prado Este 4600, Santiago de Surco, Lima, Perú',
    interiorNumber: '301',
    floor: 3,
    parkingDistance: 5,
    hasElevator: '1',
    zipCode: '15023',
    country: 'Perú',
    mapUrl: 'https://maps.google.com/?q=Av.+Javier+Prado+Este+4600',
  },
  to: {
    street: 'Av. Arequipa 2450, Lince, Lima, Perú',
    interiorNumber: '102',
    floor: 2,
    parkingDistance: 10,
    hasElevator: '0',
    zipCode: '15046',
    country: 'Perú',
    mapUrl: 'https://maps.google.com/?q=Av.+Arequipa+2450',
  },
};

/**
 * Injects address data into the Vuex store, bypassing Google Places API.
 * Vue 2 exposes the instance on the DOM element as __vue__.
 */
async function injectAddressToStore(page, direction, data) {
  const section = direction === 'from'
    ? 'orderDetailsOrigin'
    : 'orderDetailsDestination';
  const prefix = direction;

  await page.evaluate(({ section: s, prefix: p, addr }) => {
    const store = document.querySelector('#app').__vue__.$store;
    store.commit('setOrder', { section: s, field: `${p}_street`, value: addr.street });
    store.commit('setOrder', { section: s, field: `${p}_zip_code`, value: addr.zipCode });
    store.commit('setOrder', { section: s, field: `${p}_country`, value: addr.country });
    store.commit('setOrder', { section: s, field: `${p}_map_url`, value: addr.mapUrl });
  }, { section, prefix, addr: data });
}

test.describe('Order Step One - Addresses', () => {
  test('should fill step one and navigate to step two', async ({ page }) => {
    await page.goto('/order/step-one', { waitUntil: 'networkidle' });
    await page.waitForSelector('#address-from-street', { timeout: 30000 });

    // --- Origin address ---
    await page.fill('#address-from-street', TEST_DATA.from.street);
    await injectAddressToStore(page, 'from', TEST_DATA.from);

    await page.fill('#address-from-interior', TEST_DATA.from.interiorNumber);
    await page.selectOption('#address-from-floor', {
      index: TEST_DATA.from.floor,
    });
    await page.fill('#from-parking-distance', String(TEST_DATA.from.parkingDistance));
    await page.click(`#from-has-elevator-${TEST_DATA.from.hasElevator}`);

    // --- Destination address ---
    await page.fill('#address-to-street', TEST_DATA.to.street);
    await injectAddressToStore(page, 'to', TEST_DATA.to);

    await page.fill('#address-to-interior', TEST_DATA.to.interiorNumber);
    await page.selectOption('#address-to-floor', {
      index: TEST_DATA.to.floor,
    });
    await page.fill('#to-parking-distance', String(TEST_DATA.to.parkingDistance));
    await page.click(`#to-has-elevator-${TEST_DATA.to.hasElevator}`);

    // Submit
    await page.click('button:has-text("Guardar y continuar")');

    // Verify navigation to step-two
    await expect(page).toHaveURL(/step-two/, { timeout: 15000 });

    // Keep browser open for manual inspection
    await page.pause();
  });
});
