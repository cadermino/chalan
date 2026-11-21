const fs = require('fs');
const { test, expect } = require('@playwright/test');
const {
  createOrderViaApi, fillContactAndReturn, seedQuotation, cleanupSeededCarriers, openBackofficeAsAdmin,
  psql, uniqueOperationNumber,
} = require('./helpers');

// seedQuotation cotiza 450 y .env.dev tiene PLATFORM_FEE=0.1: la web muestra
// 495. La cotización formal lo toma como subtotal sin IGV y suma el 18 %:
// 495 + 89.10 = 584.10. Con YAPE_RESERVATION_REQUIRED=true (.env.dev) pide el
// adelanto de la web (45) y el saldo es el resto.
const RUC = '20510042990';
const BUSINESS_NAME = 'PMS GESTION INTEGRAL SAC';
// El cliente recibe el PDF por correo: el simulador de SES lo acepta sin
// rebotar (ADMIN_MAIL igual recibe la copia "[test]").
const CONTACT_EMAIL = 'success@simulator.amazonses.com';
const FORMAL_LINK = '¿Eres empresa? Descarga la cotización formal con RUC';

test.afterEach(() => cleanupSeededCarriers());

async function openStepThreeWithAQuotation(page) {
  const orderId = await createOrderViaApi(page);
  await fillContactAndReturn(page);
  seedQuotation(orderId);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('text=Hyundai')).toBeVisible({ timeout: 15000 });
  return orderId;
}

async function expectPdf(download) {
  expect(download.suggestedFilename()).toMatch(/^Cotizacion_PMS_GESTION_INTEGRAL_SAC_\d+_Chalan\.pdf$/);
  const bytes = fs.readFileSync(await download.path());
  expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
}

function formalQuotation(orderId) {
  const [ruc, subtotal, igv, total, byAdmin] = psql(
    `SELECT ruc, subtotal, igv, total, created_by_admin_id IS NOT NULL FROM formal_quotations
     WHERE order_id=${orderId} ORDER BY id DESC LIMIT 1;`,
  ).split('|');
  return {
    ruc, subtotal: Number(subtotal), igv: Number(igv), total: Number(total), byAdmin: byAdmin === 't',
  };
}

// En una línea: psql() devuelve solo la primera, y la nota tiene varias.
function accountingNote(orderId) {
  return psql(`SELECT replace(COALESCE(accounting_note, ''), chr(10), ' / ') FROM orders WHERE id=${orderId};`);
}

test.describe('Formal quotation (PDF with RUC)', () => {
  test('the customer downloads it from step three after a valid RUC', async ({ page }) => {
    const orderId = await openStepThreeWithAQuotation(page);

    await page.getByRole('button', { name: FORMAL_LINK }).click();
    await expect(page.locator('#fq-ruc')).toBeVisible();
    // Lo que dejó en el paso de contacto ya viene escrito.
    await expect(page.locator('#fq-contact-name')).toHaveValue('Cliente E2E');
    await expect(page.locator('#fq-contact-email')).toHaveValue(/@example\.com$/);

    // Un dígito mal en el RUC no llega al API.
    await page.fill('#fq-ruc', '20510042991');
    await page.fill('#fq-business-name', BUSINESS_NAME);
    await page.fill('#fq-contact-email', CONTACT_EMAIL);
    await page.getByRole('button', { name: 'Descargar cotización (PDF)' }).click();
    await expect(page.locator('text=Revisa el RUC')).toBeVisible();
    expect(psql(`SELECT count(*) FROM formal_quotations WHERE order_id=${orderId};`)).toBe('0');

    await page.fill('#fq-ruc', RUC);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar cotización (PDF)' }).click();
    await expectPdf(await downloadPromise);
    await expect(page.locator('text=Listo, se descargó la cotización.')).toBeVisible();
    await expect(page.locator(`text=${CONTACT_EMAIL}`)).toBeVisible();

    expect(formalQuotation(orderId)).toEqual({
      ruc: RUC, subtotal: 495, igv: 89.1, total: 584.1, byAdmin: false,
    });
    // Bajarla para comparar no marca la orden para contabilidad.
    expect(accountingNote(orderId)).toBe('');
  });

  test('choosing that quotation leaves the accounting note in the backoffice', async ({ page }) => {
    const orderId = await openStepThreeWithAQuotation(page);

    await page.getByRole('button', { name: FORMAL_LINK }).click();
    await page.fill('#fq-ruc', RUC);
    await page.fill('#fq-business-name', BUSINESS_NAME);
    await page.fill('#fq-contact-email', CONTACT_EMAIL);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar cotización (PDF)' }).click();
    await downloadPromise;
    // El botón del final, no la × de la esquina (que también se llama Cerrar).
    await page.getByText('Cerrar', { exact: true }).click();

    // Agenda la misma cotización: elegirla es lo que escribe la nota.
    await page.getByRole('button', { name: 'Elegir', exact: true }).click();
    await expect(page.locator('text=Confirma tu mudanza')).toBeVisible({ timeout: 15000 });
    await page.fill('#modal-operation-number', uniqueOperationNumber());
    await page.click('button:has-text("Agendar vehículo")');
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });

    const note = accountingNote(orderId);
    expect(note).toContain(`Chalán factura a ${BUSINESS_NAME} (RUC ${RUC}): S/ 584.10 = subtotal 495.00 + IGV 89.10.`);
    expect(note).toContain('(adelanto S/ 45.00; saldo pendiente S/ 539.10)');
    expect(note).toContain('Chalán le paga a E2E Test Carrier S/ 450.00');

    await openBackofficeAsAdmin(page, `/orders/${orderId}`);
    const warning = page.locator('div', { hasText: 'Esta orden se concilia aparte en contabilidad' }).last();
    await expect(warning).toBeVisible({ timeout: 15000 });
    await expect(warning).toContainText('pedirle factura o recibo por honorarios');
  });

  test('an admin generates it from the order detail with IGV included', async ({ page }) => {
    const orderId = await createOrderViaApi(page);
    seedQuotation(orderId);

    await openBackofficeAsAdmin(page, `/orders/${orderId}`);
    const card = page.locator('section', { hasText: 'Cotización formal (RUC)' });
    await card.getByRole('button', { name: 'Generar cotización formal' }).click();

    await card.locator('input[inputmode="numeric"]').fill(RUC);
    await card.locator('label', { hasText: 'Razón social' }).locator('input').fill(BUSINESS_NAME);
    await expect(card).toContainText('Total con IGV: S/ 584.10');
    await card.getByLabel(/El precio ya incluye IGV/).check();
    await expect(card).toContainText('Total con IGV: S/ 495.00');

    const downloadPromise = page.waitForEvent('download');
    await card.getByRole('button', { name: 'Generar y descargar PDF' }).click();
    await expectPdf(await downloadPromise);

    await expect(card).toContainText(`${BUSINESS_NAME} · RUC ${RUC}`);
    await expect(card).toContainText('S/ 495.00 con IGV');
    expect(formalQuotation(orderId)).toEqual({
      ruc: RUC, subtotal: 419.49, igv: 75.51, total: 495, byAdmin: true,
    });
  });
});
