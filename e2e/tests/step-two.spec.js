const { test, expect } = require('@playwright/test');
const { TEST_DATA, createOrderViaApi } = require('./helpers');

test.describe('Order Step Two - Appointment & Belongings', () => {
  test('should commit a typed item and advance on a single "Siguiente" click, without "+ Agregar"', async ({ page }) => {
    // This test only exercises step-two's own UI, so the order (with its
    // step-one address data) is created directly via API.
    await createOrderViaApi(page, { upTo: 'step-one' });
    await expect(page).toHaveURL(/step-two/, { timeout: 15000 });

    // Inject appointment date via Vuex store (bypasses the datetime picker popup)
    await page.evaluate((date) => {
      const store = document.querySelector('#app').__vue__.$store;
      store.commit('setOrder', { section: 'currentOrder', field: 'appointment_date', value: date });
    }, TEST_DATA.stepTwo.appointmentDate);

    // Type an item but deliberately never click "+ Agregar" or press Enter -
    // this is the exact case customers were missing. A single click on
    // "Siguiente" must both commit the item and advance the step; it must
    // not take two clicks (the first commit-only, the second to actually
    // navigate), which is what happened when this was wired through a
    // blur handler instead of nextStep() itself: adding the item grows the
    // list and pushes "Siguiente" down mid-click, so the click misses it.
    await page.fill('input[placeholder="Ej: 1 cama matrimonial"]', '1 mesa de centro');

    await page.click('button:has-text("Siguiente")');

    await expect(page).toHaveURL(/step-three/, { timeout: 15000 });

    const comments = await page.evaluate(
      () => document.querySelector('#app').__vue__.$store.state.currentOrder.comments,
    );
    expect(comments).toContain('1 mesa de centro');
  });
});
