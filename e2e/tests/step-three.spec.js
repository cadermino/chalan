const { test, expect } = require('@playwright/test');
const {
  fillStepOne, fillStepTwo, registerAndReturn, seedQuotation, getOrderIdFromStore,
} = require('./helpers');

test.describe('Order Step Three - Quotations', () => {
  test('should require login, then list and select a quotation', async ({ page }) => {
    await fillStepOne(page);
    await fillStepTwo(page);

    // step-three requires auth -> router redirects to /login?redirect=...
    await registerAndReturn(page);

    const orderId = await getOrderIdFromStore(page);
    seedQuotation(orderId);

    // Reload so the quotationsList fetch picks up the just-seeded quote.
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('text=Hyundai')).toBeVisible({ timeout: 15000 });

    // Clicking "Elegir" selects the quote and auto-advances to step-four
    // (Step-three.vue's selectQuotation() defaults jumpToNextStep to true).
    await page.getByRole('button', { name: 'Elegir', exact: true }).click();
    await expect(page).toHaveURL(/step-four/, { timeout: 15000 });
  });
});
