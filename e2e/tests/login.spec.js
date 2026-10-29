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

test.describe('Auth - a draft that is not yours', () => {
  const { psql } = require('./helpers');

  async function register(page, email, phone) {
    await page.goto('/register', { waitUntil: 'networkidle' });
    await page.fill('#email', email);
    await page.fill('#mobilePhone', phone);
    await page.fill('#name', 'Cliente E2E');
    await page.fill('#password', 'Test-password-1');
    await page.click('button:has-text("Registrame")');
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
    await page.evaluate(() => localStorage.clear());
  }

  test('logging in with another account\'s order in the browser drops it and lands on the dashboard', async ({ page }) => {
    // Pasa al abrir en el mismo navegador el link de acceso de una orden de otra
    // cuenta: la orden queda como borrador. Antes el login quedaba en "Hubo un
    // error" (el PUT de esa orden da 403) y recargar no lo arreglaba.
    const unique = Date.now();
    const owner = `e2e-owner-${unique}@example.com`;
    const other = `e2e-other-${unique}@example.com`;
    await register(page, owner, '987654324');
    await register(page, other, '987654325');

    const orderId = Number(psql(`INSERT INTO orders (customer_id, order_status_id)
      SELECT id, 1 FROM customers WHERE email = '${owner}' RETURNING id;`));

    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.evaluate((id) => {
      const store = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('main');
      store.setOrder({ section: 'currentOrder', field: 'order_id', value: id });
    }, orderId);

    await page.fill('#email', other);
    await page.fill('#password', 'Test-password-1');
    await page.click('button:has-text("Iniciar sesión")');

    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
    await expect(page.getByText('Hubo un error')).toHaveCount(0);
    const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('currentOrder') || 'null'));
    expect(draft?.order_id ?? null).not.toBe(orderId);
    expect(psql(`SELECT c.email FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ${orderId};`))
      .toBe(owner);
  });
});
