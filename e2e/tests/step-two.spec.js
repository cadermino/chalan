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
  stepTwo: {
    appointmentDate: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d.toISOString().slice(0, 10) + ' 10:00:00';
    })(),
    items: ['1 cama matrimonial', '1 sofá 3 cuerpos', '2 sillas de comedor'],
    cargo: '1',
    packaging: '0',
    approximateBudget: 500,
  },
};

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

async function fillStepOne(page) {
  await page.goto('/order/step-one', { waitUntil: 'networkidle' });
  await page.waitForSelector('#address-from-street', { timeout: 30000 });

  await page.fill('#address-from-street', TEST_DATA.from.street);
  await injectAddressToStore(page, 'from', TEST_DATA.from);
  await page.fill('#address-from-interior', TEST_DATA.from.interiorNumber);
  await page.selectOption('#address-from-floor', { index: TEST_DATA.from.floor });
  await page.fill('#from-parking-distance', String(TEST_DATA.from.parkingDistance));
  await page.click(`#from-has-elevator-${TEST_DATA.from.hasElevator}`);

  await page.fill('#address-to-street', TEST_DATA.to.street);
  await injectAddressToStore(page, 'to', TEST_DATA.to);
  await page.fill('#address-to-interior', TEST_DATA.to.interiorNumber);
  await page.selectOption('#address-to-floor', { index: TEST_DATA.to.floor });
  await page.fill('#to-parking-distance', String(TEST_DATA.to.parkingDistance));
  await page.click(`#to-has-elevator-${TEST_DATA.to.hasElevator}`);

  await page.click('button:has-text("Guardar y continuar")');
  await expect(page).toHaveURL(/step-two/, { timeout: 15000 });
}

test.describe('Order Step Two - Appointment & Belongings', () => {
  test('should fill step two and navigate to step three', async ({ page }) => {
    await fillStepOne(page);

    // Inject appointment date via Vuex store (bypasses the datetime picker popup)
    await page.evaluate((date) => {
      const store = document.querySelector('#app').__vue__.$store;
      store.commit('setOrder', { section: 'currentOrder', field: 'appointment_date', value: date });
    }, TEST_DATA.stepTwo.appointmentDate);

    // Add items via the manual input
    for (const item of TEST_DATA.stepTwo.items) {
      await page.fill('input[placeholder="Ej: 1 cama matrimonial"]', item);
      await page.click('button:has-text("+ Agregar")');
    }

    // Cargo service
    await page.click(`#cargo-service-${TEST_DATA.stepTwo.cargo}`);

    // Packaging service
    await page.click(`#packaging-service-${TEST_DATA.stepTwo.packaging}`);

    // Approximate budget (optional)
    await page.fill('#approximate-budget', String(TEST_DATA.stepTwo.approximateBudget));

    // Submit
    await page.click('button:has-text("Siguiente")');

    await expect(page).toHaveURL(/step-three/, { timeout: 15000 });

    // Keep browser open for manual inspection
    await page.pause();
  });
});
