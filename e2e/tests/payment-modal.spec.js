const { test, expect } = require('@playwright/test');
const {
  createOrderViaApi, registerAndReturn, seedQuotation,
} = require('./helpers');

// seedQuotation inserta una cotización de 450 y .env.dev tiene
// PLATFORM_FEE=0.1. La orden no viene referida, así que no hay comisión de
// agente encima.
const RAW_QUOTATION = 450;
const PLATFORM_FEE = 0.1;
// Redondeado igual que el backend, que hace round(..., 2): sin eso
// 450 * 1.1 da 495.00000000000006 en coma flotante.
const EXPECTED_TOTAL = Math.round(RAW_QUOTATION * (1 + PLATFORM_FEE) * 100) / 100;

test.describe('Cash checkout via the Step-three payment modal', () => {
  test('should pay with cash and schedule the vehicle', async ({ page }) => {
    // The modal lives on step-three; step-one/step-two UI is covered by
    // their own specs, so the order is created directly via API.
    const orderId = await createOrderViaApi(page);
    await registerAndReturn(page);

    seedQuotation(orderId);

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('text=Hyundai')).toBeVisible({ timeout: 15000 });

    // "Elegir" opens the modal in place; phone comes prefilled from
    // registration, so submitting confirms straight away.
    await page.getByRole('button', { name: 'Elegir', exact: true }).click();
    await expect(page.locator('text=Confirma tu pedido')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#modal-phone')).toHaveValue('987654321');

    // El monto del modal ya trae el fee de plataforma sumado: es el número
    // que la persona está aceptando. Se captura para compararlo contra el que
    // queda en el dashboard.
    const acceptedAmount = (await page.locator('.text-xl.font-bold').first().innerText()).trim();
    expect(acceptedAmount).toContain(String(EXPECTED_TOTAL));

    await page.click('button:has-text("Agendar vehículo")');

    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
    await expect(page.locator('text=Muy bien, tu vehículo ha sido agendado')).toBeVisible({ timeout: 10000 });

    // El dashboard leía quotation.amount en crudo, sin el fee, así que
    // mostraba menos de lo que la persona acababa de aceptar. Que las dos
    // pantallas digan lo mismo es la invariante que se rompió.
    const dashboardAmount = page.locator(`td:has-text("${acceptedAmount}")`);
    await expect(dashboardAmount).toBeVisible({ timeout: 15000 });
    await expect(page.locator(`td:text-is("${RAW_QUOTATION}")`)).toHaveCount(0);
  });

  test('should require a phone number before confirming', async ({ page }) => {
    const orderId = await createOrderViaApi(page);
    await registerAndReturn(page);

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
