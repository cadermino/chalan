const { test, expect } = require('@playwright/test');
const {
  createOrderViaApi, registerAndReturn, seedQuotation,
} = require('./helpers');

test.describe('Order Step Three - Quotations', () => {
  test('should require registration, then list a quotation and open the payment modal', async ({ page }) => {
    // Step-three doesn't test step-one/step-two's own UI behavior (that's
    // covered by their own specs), so create the order directly via API
    // instead of driving those forms just to get here.
    const orderId = await createOrderViaApi(page);

    // step-three requires auth -> router redirects to /register?redirect=...
    await registerAndReturn(page);

    seedQuotation(orderId);

    // Reload so the quotationsList fetch picks up the just-seeded quote.
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('text=Hyundai')).toBeVisible({ timeout: 15000 });

    // Clicking "Elegir" opens the cash-checkout modal in place, no
    // navigation - Step-three.vue's selectQuotation() opens the modal and
    // handles checkout itself (step-four was removed as dead code once this
    // modal took over its job).
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

  test('should show a +country-code phone in the modal instead of blanking it', async ({ page }) => {
    // Regression test: customers whose phone was saved in E.164 format
    // (e.g. by the webchat AI agent, which normalizes to "+51...") used to
    // see an empty phone field here. #modal-phone was type="number", and
    // HTML number inputs silently discard any value containing "+" - Vue's
    // v-model still held the real string, but the DOM showed blank. Fixed
    // by switching to type="tel" (see PaymentConfirmationModal.vue).
    const orderId = await createOrderViaApi(page);
    await expect(page).toHaveURL(/\/register/, { timeout: 15000 });

    const unique = Date.now();
    await page.fill('#email', `e2e-${unique}@example.com`);
    await page.fill('#mobilePhone', '+51987654321');
    await page.fill('#name', 'Cliente E2E');
    await page.fill('#password', 'Test-password-1');
    await page.click('button:has-text("Registrame")');
    await expect(page).toHaveURL(/step-three/, { timeout: 15000 });

    seedQuotation(orderId);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('text=Hyundai')).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Elegir', exact: true }).click();
    await expect(page.locator('text=Confirma tu pedido')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#modal-phone')).toHaveValue('+51987654321');
  });
});
