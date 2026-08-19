const { test, expect } = require('@playwright/test');
const {
  fillStepOne, fillStepTwo, registerAndReturn, seedQuotation, getOrderIdFromStore,
} = require('./helpers');

test.describe('Order Step Three - Quotations', () => {
  test('should require login, then list a quotation and open the payment modal', async ({ page }) => {
    await fillStepOne(page);
    await fillStepTwo(page);

    // step-three requires auth -> router redirects to /login?redirect=...
    await registerAndReturn(page);

    const orderId = await getOrderIdFromStore(page);
    seedQuotation(orderId);

    // Reload so the quotationsList fetch picks up the just-seeded quote.
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('text=Hyundai')).toBeVisible({ timeout: 15000 });

    // Clicking "Elegir" opens the cash-checkout modal in place, no navigation
    // (Step-three.vue's selectQuotation() opens the modal instead of routing
    // to step-four).
    await page.getByRole('button', { name: 'Elegir', exact: true }).click();
    await expect(page).toHaveURL(/step-three/, { timeout: 5000 });
    await expect(page.locator('text=Confirma tu pedido')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#modal-phone')).toBeVisible();

    // Closing the modal without confirming must not fire any checkout calls,
    // and the card should stay selectable-to-reopen rather than reverting.
    await page.getByRole('button', { name: 'Cerrar' }).click();
    await expect(page.locator('text=Confirma tu pedido')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Seleccionado', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Seleccionado', exact: true }).click();
    await expect(page.locator('text=Confirma tu pedido')).toBeVisible();
    await expect(page.locator('#modal-phone')).toHaveValue('987654321');
  });
});
