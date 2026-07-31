const { test, expect } = require('@playwright/test');
const {
  fillStepOne, fillStepTwo, registerAndReturn, seedQuotation, getOrderIdFromStore,
} = require('./helpers');

test.describe('Order Step Four - Payment', () => {
  test('should pay with cash and schedule the vehicle', async ({ page }) => {
    await fillStepOne(page);
    await fillStepTwo(page);
    await registerAndReturn(page);

    const orderId = await getOrderIdFromStore(page);
    seedQuotation(orderId);

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('text=Hyundai')).toBeVisible({ timeout: 15000 });
    // Clicking "Elegir" selects the quote and auto-advances to step-four.
    await page.getByRole('button', { name: 'Elegir', exact: true }).click();
    await expect(page).toHaveURL(/step-four/, { timeout: 15000 });

    // Select cash payment (there's also a disabled "Elegir (No disponible)" for card)
    await page.getByText('Elegir', { exact: true }).click();
    await expect(page.getByText('Seleccionado', { exact: true })).toBeVisible();

    // "Agendar vehículo" replaces "Proceder al pago" once cash is selected
    await page.click('button:has-text("Agendar vehículo")');

    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
    await expect(page.locator('text=Muy bien, tu vehículo ha sido agendado')).toBeVisible({ timeout: 10000 });
  });
});
