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
    await expect(page.locator('text=Confirma tu mudanza')).toBeVisible({ timeout: 15000 });
    // El teléfono vino del registro, así que el modal no lo vuelve a pedir.
    await expect(page.locator('#modal-phone')).toHaveCount(0);

    // Closing the modal without confirming must not fire any checkout calls,
    // and the card should stay selectable-to-reopen rather than reverting.
    await page.getByRole('button', { name: 'Cerrar' }).click();
    await expect(page.locator('text=Confirma tu mudanza')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Seleccionado', exact: true })).toBeVisible();

    // Reabrir por "Seleccionado" tiene que traer la cotización completa, no
    // solo su id: si llega pelada, el modal abre sin monto.
    await page.getByRole('button', { name: 'Seleccionado', exact: true }).click();
    await expect(page.locator('text=Confirma tu mudanza')).toBeVisible();
    await expect(page.locator('.text-xl.font-bold').first()).not.toHaveText(/^\s*$/);
  });

  test('should keep a +country-code phone in the modal input instead of blanking it', async ({ page }) => {
    // Regression test: #modal-phone was type="number", y los inputs numéricos
    // de HTML descartan en silencio cualquier valor con "+" — el v-model de
    // Vue guardaba el string real pero el DOM se veía vacío. Se arregló con
    // type="tel" (ver PaymentConfirmationModal.vue).
    //
    // El montaje cambió cuando el campo pasó a mostrarse solo si NO tenemos
    // teléfono: ya no se puede reproducir precargándolo desde el registro.
    // Se borra del store para que el campo aparezca y se tipea el "+51...",
    // que es la misma garantía sobre el input.
    const orderId = await createOrderViaApi(page);
    await registerAndReturn(page);

    seedQuotation(orderId);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('text=Hyundai')).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      document.querySelector('#app').__vue__.$store.commit(
        'setCustomerData', { field: 'mobile_phone', value: null },
      );
    });

    await page.getByRole('button', { name: 'Elegir', exact: true }).click();
    await expect(page.locator('text=Confirma tu mudanza')).toBeVisible({ timeout: 15000 });

    await page.fill('#modal-phone', '+51987654321');
    await expect(page.locator('#modal-phone')).toHaveValue('+51987654321');
  });
});
