const { test, expect } = require('@playwright/test');
const {
  openBackofficeAsAdmin, seedServiceRequest, getServiceRequestStatus, cleanupSeededServiceRequests,
} = require('./helpers');

// Los servicios (service_requests) en el backoffice: los mismos estados y
// filtros que las órdenes. Pendiente hasta que la reserva está pagada, En
// progreso con la reserva, Completado cuando se registra el saldo que el
// cliente le pagó al transportista. Corre contra el backoffice local
// (BACKOFFICE_URL, por defecto el dev server en :5173).
//
// Registrar la reserva le manda un correo al transportista de prueba (como
// seedQuotation en las órdenes); los WhatsApp no salen fuera de producción.

const row = (page, id) => page.locator('tbody tr', { has: page.locator(`a[href$="/service-requests/${id}"]`) });

async function filterBy(page, label) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.waitForLoadState('networkidle');
}

test.afterEach(() => cleanupSeededServiceRequests());

test.describe('Services in the backoffice', () => {
  test('the list opens on Pendiente and the filters follow the status', async ({ page }) => {
    const id = seedServiceRequest({ quotation: true });
    await openBackofficeAsAdmin(page, '/service-requests');

    await expect(page.getByRole('button', { name: 'Pendiente', exact: true })).toHaveAttribute('aria-pressed', 'true');
    // Cotizaciones y Adelanto se leen en sus columnas: una cotización, nada elegido.
    await expect(row(page, id)).toContainText('S/ 100.00');
    await expect(row(page, id).locator('td').nth(8)).toHaveText('1');

    await filterBy(page, 'En progreso');
    await expect(row(page, id)).toHaveCount(0);
    await filterBy(page, 'Todos');
    await expect(row(page, id)).toHaveCount(1);
  });

  test('a form the customer did not finish says Incompleto', async ({ page }) => {
    const id = seedServiceRequest({ submitted: false });
    await openBackofficeAsAdmin(page, '/service-requests');

    await expect(row(page, id)).toContainText('Incompleto');
  });

  test('registering the reservation and then the balance moves it to En progreso and Completado', async ({ page }) => {
    const id = seedServiceRequest({ quotation: true, selected: true });
    await openBackofficeAsAdmin(page, '/service-requests');
    await expect(row(page, id)).toContainText('Por registrar');

    await row(page, id).locator(`a[href$="/service-requests/${id}"]`).click();
    await expect(page.getByRole('heading', { name: `Servicio #${id}` })).toBeVisible();
    await expect(page.getByText('Pendiente', { exact: true })).toBeVisible();

    // La reserva: el total congelado (110) menos el precio del transportista (100).
    await expect(page.getByText('Falta la reserva de S/ 10.00')).toBeVisible();
    await page.getByRole('button', { name: 'Registrar reserva pagada' }).click();
    await page.getByRole('button', { name: 'Sí', exact: true }).click();
    await expect(page.getByText('En progreso', { exact: true })).toBeVisible();
    expect(getServiceRequestStatus(id)).toBe('in_progress');

    await page.getByRole('button', { name: 'Registrar saldo pagado' }).click();
    await page.getByRole('button', { name: 'Sí', exact: true }).click();
    await expect(page.getByText('Completado', { exact: true })).toBeVisible();
    expect(getServiceRequestStatus(id)).toBe('completed');
    // Con el trabajo hecho ya no se puede cambiar de transportista.
    await expect(page.getByRole('button', { name: 'Elegir', exact: true })).toHaveCount(0);

    await page.getByRole('link', { name: '← Servicios' }).click();
    await filterBy(page, 'Completado');
    await expect(row(page, id)).toHaveCount(1);
  });
});
