const { test, expect } = require('@playwright/test');
const {
  TEST_DATA,
  createOrderViaApi,
  dismissLeadPhoneModalIfPresent,
  getOrderIdFromStore,
  psql,
  ORDER_STATUS,
} = require('./helpers');

/**
 * La mudanza que se está pidiendo queda en el localStorage, y nada la borraba.
 * Un cliente que volvió semanas después traía la anterior: al empezar otra, el
 * paso 1 le mandaba el PUT a esa y daba error (o la reescribía). Al entrar al
 * paso 1 se descarta lo guardado que ya no es un borrador (utils/orderDraft.js).
 */

const DAY = 24 * 60 * 60 * 1000;
const OLD_STREET = 'Jr. de la mudanza anterior 123, Lima, Perú';

function origin(street = OLD_STREET) {
  return {
    from_street: street,
    from_zip_code: TEST_DATA.from.zipCode,
    from_country: TEST_DATA.from.country,
    from_map_url: TEST_DATA.from.mapUrl,
    from_floor_number: TEST_DATA.from.floor,
    from_approximate_distance_from_parking: TEST_DATA.from.parkingDistance,
    from_has_elevator: TEST_DATA.from.hasElevator,
  };
}

function destination() {
  return {
    to_street: TEST_DATA.to.street,
    to_zip_code: TEST_DATA.to.zipCode,
    to_country: TEST_DATA.to.country,
    to_map_url: TEST_DATA.to.mapUrl,
    to_floor_number: TEST_DATA.to.floor,
    to_approximate_distance_from_parking: TEST_DATA.to.parkingDistance,
    to_has_elevator: TEST_DATA.to.hasElevator,
  };
}

// Deja en el navegador lo que habría quedado de una visita anterior y vuelve a
// abrir el paso 1, como el cliente que regresa.
async function returnWithDraft(page, { order, savedAt }) {
  await page.goto('/order/step-one', { waitUntil: 'networkidle' });
  await page.evaluate(({ draft, from, to, saved }) => {
    localStorage.setItem('currentOrder', JSON.stringify(draft));
    localStorage.setItem('orderDetailsOrigin', JSON.stringify(from));
    localStorage.setItem('orderDetailsDestination', JSON.stringify(to));
    if (saved) {
      localStorage.setItem('orderDraftSavedAt', String(saved));
    } else {
      localStorage.removeItem('orderDraftSavedAt');
    }
  }, { draft: order, from: origin(), to: destination(), saved: savedAt });
  await page.goto('/order/step-one', { waitUntil: 'networkidle' });
  await page.waitForSelector('#address-from-street', { timeout: 30000 });
}

function storedOrder(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('currentOrder') || '{}'));
}

test.describe('Lo guardado de una mudanza anterior', () => {
  test('una mudanza ya agendada no vuelve al paso 1', async ({ page }) => {
    await returnWithDraft(page, {
      order: { order_id: 999001, order_status_id: ORDER_STATUS.inProgress },
      savedAt: Date.now() - DAY,
    });

    await expect(page.locator('#address-from-street')).toHaveValue('');
    expect((await storedOrder(page)).order_id ?? null).toBeNull();
  });

  test('un borrador sin tocar hace más de 5 días se descarta, pero no el tipo de carga', async ({ page }) => {
    await returnWithDraft(page, {
      order: { order_id: 999002, order_status_id: ORDER_STATUS.pending, load_type: 'cargo' },
      savedAt: Date.now() - 6 * DAY,
    });

    await expect(page.locator('#address-from-street')).toHaveValue('');
    const order = await storedOrder(page);
    expect(order.order_id ?? null).toBeNull();
    expect(order.load_type).toBe('cargo');
  });

  test('un borrador de antes de esta marca cuenta desde que se creó la orden', async ({ page }) => {
    await returnWithDraft(page, {
      order: {
        order_id: 999003,
        order_status_id: ORDER_STATUS.pending,
        created_date: new Date(Date.now() - 10 * DAY).toISOString(),
      },
      savedAt: null,
    });

    await expect(page.locator('#address-from-street')).toHaveValue('');
  });

  test('una mudanza cuya fecha ya pasó se descarta', async ({ page }) => {
    await returnWithDraft(page, {
      order: {
        order_id: 999004,
        order_status_id: ORDER_STATUS.pending,
        appointment_date: '2026-01-15 10:00:00',
      },
      savedAt: Date.now() - DAY,
    });

    await expect(page.locator('#address-from-street')).toHaveValue('');
  });

  test('un borrador de hace un día sigue donde lo dejó', async ({ page }) => {
    await returnWithDraft(page, {
      order: { order_id: 999005, order_status_id: ORDER_STATUS.pending },
      savedAt: Date.now() - DAY,
    });

    await expect(page.locator('#address-from-street')).toHaveValue(OLD_STREET);
    expect((await storedOrder(page)).order_id).toBe(999005);
  });

  test('si la orden guardada ya se agendó en otro lado, el paso 1 crea una nueva', async ({ page }) => {
    // El navegador la cree pendiente y reciente, así que no se descarta; la
    // base dice que ya está en curso y el PUT responde 409.
    const oldOrderId = await createOrderViaApi(page, { upTo: 'step-two' });
    psql(`UPDATE orders SET order_status_id = ${ORDER_STATUS.inProgress} WHERE id = ${oldOrderId}`);

    await returnWithDraft(page, {
      order: { order_id: oldOrderId, order_status_id: ORDER_STATUS.pending },
      savedAt: Date.now() - DAY,
    });
    await page.locator('button', { hasText: /Siguiente|Guardar y continuar/ }).first().click();
    await dismissLeadPhoneModalIfPresent(page);

    await expect(page).toHaveURL(/step-two/, { timeout: 15000 });
    const newOrderId = await getOrderIdFromStore(page);
    expect(newOrderId).toBeTruthy();
    expect(newOrderId).not.toBe(oldOrderId);
    expect(psql(`SELECT street FROM order_details WHERE order_id = ${oldOrderId} AND type = 'carry_from'`))
      .toBe(TEST_DATA.from.street);
  });
});
