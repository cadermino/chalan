const { execSync } = require('child_process');
const { test, expect } = require('@playwright/test');
const { TEST_DATA, injectAddressToStore, getOrderIdFromStore } = require('./helpers');

/**
 * Fills and submits step-one WITHOUT dismissing the lead-phone modal,
 * so these tests can interact with it directly. This is the one flow that
 * must drive the step-one form for real: the modal fires on its submit.
 */
async function submitStepOneAnonymously(page) {
  await page.goto('/order/step-one', { waitUntil: 'networkidle' });
  await page.waitForSelector('#address-from-street', { timeout: 30000 });

  await page.fill('#address-from-street', TEST_DATA.from.street);
  await injectAddressToStore(page, 'from', TEST_DATA.from);
  await page.selectOption('#address-from-floor', { index: TEST_DATA.from.floor });
  await page.fill('#from-parking-distance', String(TEST_DATA.from.parkingDistance));
  await page.setChecked('#from-has-elevator-checkbox', TEST_DATA.from.hasElevator === '1');

  await page.fill('#address-to-street', TEST_DATA.to.street);
  await injectAddressToStore(page, 'to', TEST_DATA.to);
  await page.selectOption('#address-to-floor', { index: TEST_DATA.to.floor });
  await page.fill('#to-parking-distance', String(TEST_DATA.to.parkingDistance));
  await page.setChecked('#to-has-elevator-checkbox', TEST_DATA.to.hasElevator === '1');

  await page.click('button:has-text("Guardar y continuar")');
}

function getOrderLeadPhone(orderId) {
  return execSync(
    `docker exec chalan-db-1 psql -U chalan_user -d chalan -tAc "SELECT lead_phone FROM orders WHERE id=${orderId};"`,
  ).toString().trim();
}

test.describe('Lead-phone modal (anonymous step-one to step-two)', () => {
  test('shows the modal, "Omitir por ahora" proceeds without saving a phone', async ({ page }) => {
    await submitStepOneAnonymously(page);

    await expect(page.locator('text=¿Te ayudamos por WhatsApp?')).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/step-one/);

    const orderId = await getOrderIdFromStore(page);
    await page.click('button:has-text("Omitir por ahora")');

    await expect(page).toHaveURL(/step-two/, { timeout: 15000 });
    expect(getOrderLeadPhone(orderId)).toBe('');
  });

  test('submitting a phone saves it on the order and proceeds', async ({ page }) => {
    await submitStepOneAnonymously(page);
    await expect(page.locator('#lead-phone')).toBeVisible({ timeout: 15000 });

    const orderId = await getOrderIdFromStore(page);
    await page.fill('#lead-phone', '955111222');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();

    await expect(page).toHaveURL(/step-two/, { timeout: 15000 });
    expect(getOrderLeadPhone(orderId)).toBe('955111222');
  });

  test('closing the modal with the × behaves like skipping', async ({ page }) => {
    await submitStepOneAnonymously(page);
    await expect(page.locator('#lead-phone')).toBeVisible({ timeout: 15000 });

    await page.click('button[aria-label="Cerrar"]');

    await expect(page).toHaveURL(/step-two/, { timeout: 15000 });
  });

  test('does not reappear after being dismissed once in the same session', async ({ page }) => {
    await submitStepOneAnonymously(page);
    await expect(page.locator('#lead-phone')).toBeVisible({ timeout: 15000 });
    await page.click('button:has-text("Omitir por ahora")');
    await expect(page).toHaveURL(/step-two/, { timeout: 15000 });

    // Go back to step-one and resubmit — the modal should not show again.
    await page.goto('/order/step-one', { waitUntil: 'networkidle' });
    await page.waitForSelector('#address-from-street', { timeout: 30000 });
    await page.click('button:has-text("Guardar y continuar")');

    await expect(page).toHaveURL(/step-two/, { timeout: 15000 });
    await expect(page.locator('text=¿Te ayudamos por WhatsApp?')).not.toBeVisible();
  });
});
