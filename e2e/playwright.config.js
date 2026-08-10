const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  // The local dev backend (`flask run`, no --with-threads) handles one
  // request at a time. Playwright defaults to running spec files in
  // parallel outside CI, so multiple full order flows (register, create
  // order, 5s quotation polling, ...) end up queued behind each other and
  // can blow past action/test timeouts — not a real app bug, production
  // runs gunicorn with multiple workers and isn't affected. Force serial
  // runs against this backend.
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost',
    headless: false,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000,
    launchOptions: {
      // SLOWMO=3000 npx playwright test ... adds a delay (ms) after every
      // Playwright action, so a human watching the headed browser can
      // actually follow along instead of it flashing by. 0 by default.
      slowMo: process.env.SLOWMO ? Number(process.env.SLOWMO) : 0,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
