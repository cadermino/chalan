const { test, expect } = require('@playwright/test');
const {
  createOrderViaApi, registerAndReturn, seedQuotation, getPayments, getOrderStatusId,
  getQuotationId, ORDER_STATUS, uniqueOperationNumber, confirmReservationAsAdmin,
} = require('./helpers');

// Reserva con Yape obligatoria para agendar. Depende de .env.dev
// (YAPE_RESERVATION_REQUIRED=true) y de frontend/.env.development
// (VUE_APP_YAPE_QR_ENABLED=true). seedQuotation deja una cotización de 450 con
// PLATFORM_FEE=0.1: la reserva es 45 y el resto va en efectivo al transportista.
//
// Los correos (a operaciones, al cliente, al transportista) no se leen acá:
// salen por SMTP y no hay buzón que consultar. Su contenido —incluidos nombre
// y teléfono de las dos partes— lo cubren tests/test_orders.py.

/** Orden con una cotización lista, el cliente registrado y el modal abierto. */
async function openPaymentModal(page) {
  const orderId = await createOrderViaApi(page);
  await registerAndReturn(page);
  const carrierId = seedQuotation(orderId);

  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('text=Hyundai')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Elegir', exact: true }).click();
  await expect(page.locator('text=Confirma tu mudanza')).toBeVisible({ timeout: 15000 });
  return { orderId, carrierId };
}

test.describe('Yape reservation required to book', () => {
  test('should ask for the reservation and not book without an operation number', async ({ page }) => {
    const { orderId } = await openPaymentModal(page);

    await expect(page.locator('text=Yapea tu reserva para agendar')).toBeVisible();
    await expect(page.locator('text=(opcional)')).toHaveCount(0);
    await expect(page.locator('#modal-operation-number')).toBeVisible();

    // Vacío, y con algo que no son dígitos: en los dos casos el modal se queda
    // donde está sin tocar el servidor.
    for (const attempt of ['', 'abc']) {
      await page.fill('#modal-operation-number', attempt);
      await page.click('button:has-text("Agendar vehículo")');
      await expect(page.locator('text=ingresa el número de operación de tu yapeo')).toBeVisible();
      await expect(page).toHaveURL(/step-three/);
    }

    expect(getPayments(orderId)).toHaveLength(0);
    expect(getOrderStatusId(orderId)).toBe(ORDER_STATUS.pending);
  });

  test('should keep the order pending until an admin confirms the payment', async ({ page, request }) => {
    const { orderId } = await openPaymentModal(page);
    const operationNumber = uniqueOperationNumber();

    await page.fill('#modal-operation-number', operationNumber);
    await page.click('button:has-text("Agendar vehículo")');

    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
    await expect(page.locator('text=Recibimos tu número de operación')).toBeVisible({ timeout: 10000 });

    // El cliente solo informó el número: la reserva espera verificación y la
    // orden no se mueve, así que el transportista todavía no la ve.
    const payments = getPayments(orderId);
    const reservation = payments.find((payment) => payment.concept === 'reservation');
    expect(reservation).toMatchObject({ amount: 45, status: 'pending', reference: operationNumber });
    expect(payments.find((payment) => payment.concept === 'carrier_cash')).toMatchObject({
      amount: 450, status: 'pending',
    });
    expect(getOrderStatusId(orderId)).toBe(ORDER_STATUS.pending);

    // El admin ve el yapeo en su celular y marca la reserva como pagada: recién
    // ahí la orden pasa a en progreso.
    const confirmation = await confirmReservationAsAdmin(request, orderId);
    expect(confirmation.order_confirmation).toBe('ok');
    expect(confirmation.payment.status).toBe('paid');
    expect(getOrderStatusId(orderId)).toBe(ORDER_STATUS.inProgress);
    expect(getPayments(orderId).find((payment) => payment.concept === 'reservation').status).toBe('paid');

    // Confirmar de nuevo no vuelve a mover nada ni reenvía los correos.
    const again = await confirmReservationAsAdmin(request, orderId);
    expect(again.order_confirmation).toBe('unchanged');
    expect(getOrderStatusId(orderId)).toBe(ORDER_STATUS.inProgress);
  });

  test('should reject an operation number already used on another order', async ({ page, browser }) => {
    const operationNumber = uniqueOperationNumber();

    await openPaymentModal(page);
    await page.fill('#modal-operation-number', operationNumber);
    await page.click('button:has-text("Agendar vehículo")');
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });

    // Otro cliente, en otro contexto del navegador (el primero sigue logueado).
    const context = await browser.newContext();
    const otherPage = await context.newPage();
    try {
      const { orderId: otherOrderId } = await openPaymentModal(otherPage);
      await otherPage.fill('#modal-operation-number', operationNumber);
      await otherPage.click('button:has-text("Agendar vehículo")');

      await expect(otherPage.locator('text=ese número de operación ya se usó en otra orden')).toBeVisible();
      await expect(otherPage).toHaveURL(/step-three/);
      expect(getPayments(otherOrderId)).toHaveLength(0);
      expect(getOrderStatusId(otherOrderId)).toBe(ORDER_STATUS.pending);

      // Con otro número sí agenda: el rechazo no dejó la orden a medias.
      await otherPage.fill('#modal-operation-number', uniqueOperationNumber());
      await otherPage.click('button:has-text("Agendar vehículo")');
      await expect(otherPage).toHaveURL(/dashboard/, { timeout: 15000 });
      expect(getPayments(otherOrderId)).toHaveLength(2);
    } finally {
      await context.close();
    }
  });

  test('should also require the reservation from the carrier page', async ({ page }) => {
    // La página pública del transportista abre el mismo modal. Sin exigirlo
    // ahí, bastaba entrar por este camino para agendar sin pagar.
    const orderId = await createOrderViaApi(page);
    await registerAndReturn(page);
    const carrierId = seedQuotation(orderId);
    const quotationId = getQuotationId(orderId);

    // Se navega con el router de la app para conservar la orden en el store.
    await page.evaluate(({ id, quotation }) => {
      document.querySelector('#app').__vue__.$router.push({
        name: 'carrier-company', params: { id }, query: { quotation_id: quotation },
      });
    }, { id: carrierId, quotation: quotationId });

    await page.getByRole('button', { name: 'Agendar', exact: true }).click({ timeout: 15000 });
    await expect(page.locator('text=Confirma tu mudanza')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Yapea tu reserva para agendar')).toBeVisible();

    await page.click('button:has-text("Agendar vehículo")');
    await expect(page.locator('text=ingresa el número de operación de tu yapeo')).toBeVisible();
    expect(getPayments(orderId)).toHaveLength(0);

    const operationNumber = uniqueOperationNumber();
    await page.fill('#modal-operation-number', operationNumber);
    await page.click('button:has-text("Agendar vehículo")');
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });

    const reservation = getPayments(orderId).find((payment) => payment.concept === 'reservation');
    expect(reservation).toMatchObject({ status: 'pending', reference: operationNumber });
    expect(getOrderStatusId(orderId)).toBe(ORDER_STATUS.pending);
  });
});
