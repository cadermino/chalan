const { test, expect } = require('@playwright/test');
const {
  TEST_DATA,
  createOrderViaApi,
  dismissLeadPhoneModalIfPresent,
  getOrderIdFromStore,
  getOrderLoad,
  mockGooglePlaces,
  selectMockAutocompleteAddress,
} = require('./helpers');

const FROM_ADDRESS = {
  formattedAddress: 'Av. Javier Prado Este 4600, Santiago de Surco, Lima, Perú',
  zipCode: '15023',
  country: 'Perú',
  mapUrl: 'https://maps.google.com/?q=Av.+Javier+Prado+Este+4600',
  lat: -12.0906,
  lng: -76.9776,
};

const TO_ADDRESS = {
  formattedAddress: 'Av. Arequipa 2450, Lince, Lima, Perú',
  zipCode: '15046',
  country: 'Perú',
  mapUrl: 'https://maps.google.com/?q=Av.+Arequipa+2450',
  lat: -12.0894,
  lng: -77.0328,
};

const loadButton = (page, value) => page.locator(`#load-type [data-load-type="${value}"]`);

async function setAppointmentDate(page) {
  await page.evaluate((date) => {
    const store = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('main');
    store.setOrder({ section: 'currentOrder', field: 'appointment_date', value: date });
  }, TEST_DATA.stepTwo.appointmentDate);
}

async function setLoadType(page, value) {
  await page.evaluate((loadType) => {
    const store = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('main');
    store.setOrder({ section: 'currentOrder', field: 'load_type', value: loadType });
  }, value);
}

/**
 * Una de cada cuatro órdenes era carga (sacos, ladrillos, una camioneta) y el
 * formulario solo hablaba de mudanzas. Ahora se elige qué se lleva (en el
 * widget o en el paso 1) y una carga pide su peso antes de salir a cotizar.
 */
test.describe('What the order carries', () => {
  test('the freight page opens the widget on cargo and Step One gets it', async ({ page }) => {
    await mockGooglePlaces(page);
    await page.goto('/fletes-peru', { waitUntil: 'networkidle' });

    const cargoChip = page.locator('.load-chip', { hasText: 'Carga o materiales' });
    await expect(cargoChip).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.size-label', { hasText: 'Camión grande' })).toBeVisible();

    await selectMockAutocompleteAddress(page, '¿Desde dónde?', FROM_ADDRESS);
    await selectMockAutocompleteAddress(page, '¿Hasta dónde?', TO_ADDRESS);
    await page.click('a:has-text("Continuar con esta cotización")');
    await expect(page).toHaveURL(/\/order\/step-one/, { timeout: 15000 });

    // Lo marcado en el widget llega por localStorage, sin tocar los chips.
    await expect(loadButton(page, 'cargo')).toHaveAttribute('aria-pressed', 'true');
    // Una carga se recoge a nivel de calle: el piso arranca en el primero.
    await expect(page.locator('#address-from-floor')).toHaveValue('1');
    await expect(page.locator('#address-to-floor')).toHaveValue('1');
    await expect(page.locator('label[for="address-from-floor"]')).toContainText('Piso');
    await expect(page.locator('label[for="address-from-floor"]')).not.toContainText('vivienda');

    await page.click('button:has-text("Guardar y continuar")');
    await dismissLeadPhoneModalIfPresent(page);
    await expect(page).toHaveURL(/step-two/, { timeout: 15000 });

    const orderId = await getOrderIdFromStore(page);
    expect(getOrderLoad(orderId)).toEqual({ loadType: 'cargo', cargoWeightKg: null });
  });

  test('the homepage widget starts on moving with the room sizes', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page.locator('.load-chip', { hasText: 'Mudanza' }).first()).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.size-hint', { hasText: 'Depto de 1–2 habitaciones' }).first()).toBeVisible();
  });

  test('a cargo asks for its weight before Step Two lets it through', async ({ page }) => {
    await createOrderViaApi(page, { upTo: 'step-one' });
    await expect(page).toHaveURL(/step-two/, { timeout: 15000 });
    await setLoadType(page, 'cargo');
    await setAppointmentDate(page);

    await expect(page.locator('label[for="list-of-belongings"]')).toContainText('Describe la carga');
    await page.fill('input[placeholder="Ej: 200 sacos de arroz de 50 kg"]', '200 sacos de arroz de 50 kg');

    await page.click('button:has-text("Siguiente")');
    await expect(page).toHaveURL(/step-two/);
    await expect(page.locator('#cargo-weight')).toHaveClass(/border-red-300/);

    await page.selectOption('#cargo-weight', '10000');
    await page.click('button:has-text("Siguiente")');
    await expect(page).toHaveURL(/step-three|contacto/, { timeout: 15000 });

    const orderId = await getOrderIdFromStore(page);
    expect(getOrderLoad(orderId)).toEqual({ loadType: 'cargo', cargoWeightKg: 10000 });
  });

  test('a move asks for no weight', async ({ page }) => {
    await createOrderViaApi(page, { upTo: 'step-one' });
    await expect(page).toHaveURL(/step-two/, { timeout: 15000 });

    await expect(page.locator('label[for="list-of-belongings"]')).toContainText('Lista las cosas que vamos a mover');
    await expect(page.locator('#cargo-weight')).toHaveCount(0);
  });

  test('choosing another load in Step One drops the weight of a cargo', async ({ page }) => {
    await createOrderViaApi(page, { upTo: 'step-one' });
    await expect(page).toHaveURL(/step-two/, { timeout: 15000 });
    await setLoadType(page, 'cargo');
    await setAppointmentDate(page);
    await page.fill('input[placeholder="Ej: 200 sacos de arroz de 50 kg"]', '300 cajas navideñas');
    await page.selectOption('#cargo-weight', '1500');
    await page.click('button:has-text("Siguiente")');
    await expect(page).toHaveURL(/step-three|contacto/, { timeout: 15000 });
    const orderId = await getOrderIdFromStore(page);

    await page.goto('/order/step-one', { waitUntil: 'networkidle' });
    await loadButton(page, 'items').click();
    await page.click('button:has-text("Guardar y continuar")');
    await dismissLeadPhoneModalIfPresent(page);
    await expect(page).toHaveURL(/step-two/, { timeout: 15000 });

    expect(getOrderLoad(orderId)).toEqual({ loadType: 'items', cargoWeightKg: null });
  });

  test('a photo with nothing recognizable says so instead of adding the refusal', async ({ page }) => {
    // El modelo a veces se niega ("Lo siento, no puedo ayudar con eso.") y esa
    // frase entraba al inventario (órdenes 139 y 159). Ahora la API la descarta
    // y el formulario avisa que no reconoció nada.
    await page.route('**/order/recognize-items', route => route.fulfill({ json: { items: [] } }));
    await createOrderViaApi(page, { upTo: 'step-one' });
    await expect(page).toHaveURL(/step-two/, { timeout: 15000 });

    await page.setInputFiles('input[type="file"]', {
      name: 'carga.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64'),
    });

    await expect(page.getByText('No reconocimos objetos en esta foto')).toBeVisible();
    const comments = await page.evaluate(
      () => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('main').currentOrder.comments,
    );
    expect(comments || '').toBe('');
  });
});
