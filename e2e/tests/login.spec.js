const { test, expect } = require('@playwright/test');

test.describe('Auth - Register & Login', () => {
  test('should register a new customer and land on the dashboard', async ({ page }) => {
    await page.goto('/register', { waitUntil: 'networkidle' });

    const unique = Date.now();
    const email = `e2e-register-${unique}@example.com`;

    await page.fill('#email', email);
    await page.fill('#mobilePhone', '987654321');
    await page.fill('#name', 'Cliente E2E');
    await page.fill('#password', 'Test-password-1');
    await page.click('button:has-text("Registrame")');

    // No ?redirect= query param on a bare /register visit, so it defaults to /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
  });

  test('should log in with an already-registered customer', async ({ page }) => {
    // Register first so we have known-good credentials to log back in with.
    await page.goto('/register', { waitUntil: 'networkidle' });
    const unique = Date.now();
    const email = `e2e-login-${unique}@example.com`;
    const password = 'Test-password-1';

    await page.fill('#email', email);
    await page.fill('#mobilePhone', '987654322');
    await page.fill('#name', 'Cliente E2E Login');
    await page.fill('#password', password);
    await page.click('button:has-text("Registrame")');
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });

    // Clear session and log back in with the same credentials.
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button:has-text("Iniciar sesión")');

    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
  });

  test('should reject login with wrong password', async ({ page }) => {
    await page.goto('/register', { waitUntil: 'networkidle' });
    const unique = Date.now();
    const email = `e2e-badlogin-${unique}@example.com`;

    await page.fill('#email', email);
    await page.fill('#mobilePhone', '987654323');
    await page.fill('#name', 'Cliente E2E Bad Login');
    await page.fill('#password', 'Test-password-1');
    await page.click('button:has-text("Registrame")');
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });

    await page.evaluate(() => localStorage.clear());
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.fill('#email', email);
    await page.fill('#password', 'wrong-password');
    await page.click('button:has-text("Iniciar sesión")');

    // Stays on /login instead of reaching the dashboard
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/login/);
  });
});
