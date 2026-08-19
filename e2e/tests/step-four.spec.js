const { test, expect } = require('@playwright/test');
const {
  fillStepOne, fillStepTwo, registerAndReturn, seedQuotation, getOrderIdFromStore,
} = require('./helpers');

test.describe('Cash checkout via the Step-three payment modal', () => {
  test('should pay with cash and schedule the vehicle', async ({ page }) => {
    await fillStepOne(page);
    await fillStepTwo(page);
    await registerAndReturn(page);

    const orderId = await getOrderIdFromStore(page);
    seedQuotation(orderId);

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('text=Hyundai')).toBeVisible({ timeout: 15000 });

    // "Elegir" opens the modal in place; phone comes prefilled from
    // registration, so submitting confirms straight away.
    await page.getByRole('button', { name: 'Elegir', exact: true }).click();
    await expect(page.locator('text=Confirma tu pedido')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#modal-phone')).toHaveValue('987654321');

    await page.click('button:has-text("Agendar vehículo")');

    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
    await expect(page.locator('text=Muy bien, tu vehículo ha sido agendado')).toBeVisible({ timeout: 10000 });
  });

  test('should require a phone number before confirming', async ({ page }) => {
    await fillStepOne(page);
    await fillStepTwo(page);
    await registerAndReturn(page);

    const orderId = await getOrderIdFromStore(page);
    seedQuotation(orderId);

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('text=Hyundai')).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Elegir', exact: true }).click();
    await expect(page.locator('text=Confirma tu pedido')).toBeVisible({ timeout: 15000 });

    await page.fill('#modal-phone', '');
    await page.click('button:has-text("Agendar vehículo")');

    await expect(page.locator('text=no olvides ingresar tu teléfono')).toBeVisible();
    await expect(page).toHaveURL(/step-three/);
  });
});

test.describe('Step-four direct URL (dead-but-reachable, card checkout not enabled yet)', () => {
  test('should still render for a completed order', async ({ page }) => {
    await fillStepOne(page);
    await fillStepTwo(page);
    await registerAndReturn(page);

    const orderId = await getOrderIdFromStore(page);
    seedQuotation(orderId);

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('text=Hyundai')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Elegir', exact: true }).click();
    await expect(page.locator('text=Confirma tu pedido')).toBeVisible({ timeout: 15000 });
    await page.click('button:has-text("Agendar vehículo")');
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });

    await page.goto(`/order/${orderId}/step-four`, { waitUntil: 'networkidle' });
    await expect(page.locator('text=Total a pagar')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Elegir (No disponible)')).toBeVisible();
  });
});
