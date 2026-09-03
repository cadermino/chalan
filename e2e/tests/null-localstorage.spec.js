const { test, expect } = require('@playwright/test');

test('app boots without crashing when window.localStorage is null', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err));

  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get: () => null });
  });

  await page.goto('/order/step-one', { waitUntil: 'networkidle' });

  // The app must still have booted and rendered real content, not just
  // avoided throwing.
  await expect(page.locator('#address-from-street')).toBeVisible({ timeout: 15000 });

  expect(pageErrors, `Uncaught page errors: ${pageErrors.map(e => e.message).join('; ')}`).toHaveLength(0);
});
