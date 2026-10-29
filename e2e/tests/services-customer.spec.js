const { test, expect } = require('@playwright/test');
const {
  mockGooglePlaces, uniqueOperationNumber, openBackofficeAsAdmin, seedServiceRequest, seedServiceQuotation,
  findServiceRequestByWhatsapp, getServiceRequestStatus, getServiceRequestPublicId, cleanupSeededServiceRequests,
} = require('./helpers');

// Lo que ve el cliente de un servicio de embalaje (services-web), de punta a
// punta: el formulario, su página de cotizaciones, el yapeo de la reserva y
// cómo queda cuando Chalán lo confirma y registra el saldo. Depende de .env.dev
// (YAPE_RESERVATION_REQUIRED=true, PLATFORM_FEE=0.1): una cotización de 100 da
// un total de 110, con 10 de reserva.
//
// La cotización la siembra seedServiceQuotation en vez del link del
// transportista. Enviar el formulario avisa al admin por correo; las empresas
// demo que ofrecen embalaje no tienen correo ni teléfono, y los WhatsApp no
// salen fuera de producción.

const FORM = '/embalaje/cotizar';
const STORAGE_KEY = 'chalan_packing_request';

/** Pasado mañana en Lima, como lo pide el input date (el formulario no acepta hoy). */
function inTwoDaysInLima() {
  const date = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(date);
}

/** Nueve dígitos que empiezan con 9, distintos en cada corrida: así se encuentra el servicio. */
function uniqueWhatsapp() {
  return `9${String(Date.now()).slice(-8)}`;
}

/** Elige una dirección del autocompletado falso de Google (mockGooglePlaces). */
async function pickAddress(page, formatted) {
  await page.waitForFunction(
    () => (window.__autocompleteInstances || []).some((entry) => entry.input.id === 'address-street'),
    null,
    { timeout: 15000 },
  );
  await page.evaluate((address) => {
    const entry = window.__autocompleteInstances.find((e) => e.input.id === 'address-street');
    entry.instance.__select({
      formatted_address: address,
      url: 'https://maps.google.com/?cid=123',
      address_components: [
        { long_name: 'Miraflores', short_name: 'Miraflores', types: ['sublocality_level_1'] },
        { long_name: 'Lima', short_name: 'Lima', types: ['administrative_area_level_2'] },
        { long_name: 'Lima', short_name: 'Lima', types: ['administrative_area_level_1'] },
        { long_name: 'Perú', short_name: 'PE', types: ['country'] },
      ],
    });
  }, formatted);
}

test.afterEach(() => cleanupSeededServiceRequests());

test.describe('A packing customer, start to finish', () => {
  test('fills the form, picks a quotation, yapes the reservation and ends up scheduled', async ({ page }) => {
    await mockGooglePlaces(page);
    const whatsapp = uniqueWhatsapp();

    // 1. El formulario: dirección, qué embalamos, fecha y WhatsApp.
    await page.goto(FORM, { waitUntil: 'networkidle' });
    await pickAddress(page, 'Av. Larco 345, Miraflores, Lima, Perú');
    await page.getByRole('button', { name: 'Siguiente' }).click();

    await expect(page.getByRole('heading', { name: '¿Qué hay que embalar?' })).toBeVisible();
    await page.getByRole('button', { name: '+ Sofá' }).click();
    await page.getByRole('button', { name: 'Siguiente' }).click();

    await expect(page.getByRole('heading', { name: '¿Cuándo lo necesitas?' })).toBeVisible();
    await page.fill('#preferred-date', inTwoDaysInLima());
    await page.fill('#customer-name', 'Carla');
    await page.fill('#whatsapp', whatsapp);
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();

    await expect(page.getByRole('heading', { name: '¡Recibimos tu solicitud!' })).toBeVisible({ timeout: 15000 });
    const request = findServiceRequestByWhatsapp(`+51${whatsapp}`);
    expect(getServiceRequestStatus(request.id)).toBe('pending');

    // 2. Llega una cotización y el cliente la ve en su página.
    seedServiceQuotation(request.id);
    await page.getByRole('link', { name: 'Ver mis cotizaciones' }).click();
    await expect(page).toHaveURL(new RegExp(`${FORM}/cotizaciones/${request.publicId}`));
    await expect(page.getByText('E2E Embalajes')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('S/ 110.00').first()).toBeVisible();

    // 3. La elige y yapea la reserva: queda por verificar, todavía pendiente.
    await page.getByRole('button', { name: 'Elegir esta' }).click();
    await expect(page.getByRole('heading', { name: 'Confirma tu servicio' })).toBeVisible();
    await expect(page.getByText('Yapea tu reserva para agendar')).toBeVisible();
    const operationNumber = uniqueOperationNumber();
    await page.fill('#operation-number', operationNumber);
    await page.getByRole('button', { name: 'Agendar' }).click();

    await expect(page.getByText('Estamos verificando tu yapeo')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(`Recibimos tu número de operación ${operationNumber}`)).toBeVisible();
    expect(getServiceRequestStatus(request.id)).toBe('pending');

    // 4. Chalán encuentra el yapeo en el backoffice: en progreso.
    const admin = await page.context().newPage();
    await openBackofficeAsAdmin(admin, `/service-requests/${request.id}`);
    await admin.getByRole('button', { name: 'Confirmar yapeo' }).click();
    await admin.getByRole('button', { name: 'Sí', exact: true }).click();
    await expect(admin.getByText('En progreso', { exact: true })).toBeVisible({ timeout: 15000 });
    expect(getServiceRequestStatus(request.id)).toBe('in_progress');

    // El cliente ve su servicio agendado, con cuánto le paga al transportista.
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText('¡Listo! Tu servicio con E2E Embalajes quedó agendado')).toBeVisible();
    await expect(page.getByText('Ya yapeaste S/ 10.00. El día del servicio le pagas S/ 100.00 a E2E Embalajes.'))
      .toBeVisible();
    await expect(page.getByRole('button', { name: 'Elegir esta' })).toHaveCount(0);

    // 5. Hecho el trabajo, Chalán registra el saldo: completado. El cliente lo ve
    //    terminado y puede calificar a quien lo hizo.
    await admin.getByRole('button', { name: 'Registrar saldo pagado' }).click();
    await admin.getByRole('button', { name: 'Sí', exact: true }).click();
    await expect(admin.getByText('Completado', { exact: true })).toBeVisible({ timeout: 15000 });
    expect(getServiceRequestStatus(request.id)).toBe('completed');

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText('Tu servicio con E2E Embalajes está terminado.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Calificar a E2E Embalajes' }))
      .toHaveAttribute('href', /^\/reviews\/submit\//);
  });

  test('coming back to the form resumes a draft, but not one already sent', async ({ page }) => {
    await mockGooglePlaces(page);
    const draft = seedServiceRequest({ submitted: false });
    const sent = seedServiceRequest();

    // Un borrador guardado se retoma: la dirección que dejó sigue ahí.
    await page.goto(FORM, { waitUntil: 'networkidle' });
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, getServiceRequestPublicId(draft)]);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('#address-street')).toHaveValue('Av. E2E 123');

    // Uno que ya se envió (otra pestaña, otro día) no: el formulario empieza de cero.
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, getServiceRequestPublicId(sent)]);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('#address-street')).toHaveValue('');
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBeNull();
  });
});

// Pintura no tiene lista: el cliente cuenta qué pintar (o lo explica en un
// video) y contesta unas preguntas opcionales. Sin pintores locales con
// "Pintura" marcada, enviar solo avisa al admin.
test.describe('A painting customer, start to finish', () => {
  const PAINTING_FORM = '/pintura/cotizar';

  test('the landing sends them to the form, WhatsApp stays as a second option', async ({ page }) => {
    await page.goto('/pintores-a-domicilio', { waitUntil: 'networkidle' });

    await expect(page.locator('main a[href="/pintura/cotizar"]').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Prefiero escribir por WhatsApp' })).toHaveAttribute('href', /wa\.me/);
  });

  test('describes the job, gets quoted, and the admin sees what to paint', async ({ page }) => {
    await mockGooglePlaces(page);
    const whatsapp = uniqueWhatsapp();

    await page.goto(PAINTING_FORM, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: '¿Dónde hay que pintar?' })).toBeVisible();
    await pickAddress(page, 'Av. Pardo 610, Miraflores, Lima, Perú');
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // Sin descripción ni video no avanza.
    await expect(page.getByRole('heading', { name: '¿Qué quieres pintar?' })).toBeVisible();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByRole('alert')).toContainText('Cuéntanos qué hay que pintar');

    await page.fill('#painting-description', 'Sala y comedor, paredes y techo. Blanco humo.');
    await page.getByText('Interior', { exact: true }).click();
    await page.getByText('2 a 3 ambientes', { exact: true }).click();
    await page.fill('#painting-m2', '45');
    await page.getByText('Que la incluya el pintor', { exact: true }).click();
    await page.getByText('Humedad', { exact: true }).click();
    await page.getByRole('button', { name: 'Siguiente' }).click();

    await expect(page.getByRole('heading', { name: '¿Cuándo lo necesitas?' })).toBeVisible();
    await expect(page.getByText('Sala y comedor, paredes y techo. Blanco humo.')).toBeVisible();
    await expect(page.getByText('Interior · 2 a 3 ambientes · 45 m² · Pintura: que la incluya el pintor · Paredes: humedad'))
      .toBeVisible();
    await page.fill('#preferred-date', inTwoDaysInLima());
    await page.fill('#customer-name', 'Carla');
    await page.fill('#whatsapp', whatsapp);
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();

    await expect(page.getByRole('heading', { name: '¡Recibimos tu solicitud!' })).toBeVisible({ timeout: 15000 });
    const request = findServiceRequestByWhatsapp(`+51${whatsapp}`);

    // Le cotizan y en su página ve lo que pidió; el saldo se paga al terminar.
    seedServiceQuotation(request.id);
    await page.getByRole('link', { name: 'Ver mis cotizaciones' }).click();
    await expect(page.getByText('E2E Embalajes')).toBeVisible({ timeout: 15000 });
    await page.getByText('Qué pintamos').click();
    await expect(page.getByText('Sala y comedor, paredes y techo. Blanco humo.')).toBeVisible();
    await page.getByRole('button', { name: 'Elegir esta' }).click();
    await expect(page.getByText('se lo pagas a E2E Embalajes al terminar el trabajo')).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar' }).click();

    // El admin ve qué hay que pintar en el detalle.
    const admin = await page.context().newPage();
    await openBackofficeAsAdmin(admin, `/service-requests/${request.id}`);
    await expect(admin.getByText('Qué hay que pintar')).toBeVisible();
    await expect(admin.getByText('Sala y comedor, paredes y techo. Blanco humo.')).toBeVisible();
    await expect(admin.getByText('La incluye el pintor')).toBeVisible();
    await expect(admin.getByText('45 m²')).toBeVisible();
  });
});

// Porcelanato y cerámica (`masonry`): como pintura, se cuenta con palabras, más
// las respuestas que mueven el precio por m². No se envía: en local hay una
// empresa de prueba con el servicio marcado y un correo real, y enviar la
// avisaría. El envío lo cubren los tests del API (test_a_tile_request_...).
test.describe('A tile installation customer', () => {
  const TILE_FORM = '/porcelanato/cotizar';

  test('the landing sends them to the form, WhatsApp stays as a second option', async ({ page }) => {
    await page.goto('/instalacion-de-porcelanato', { waitUntil: 'networkidle' });

    await expect(page.locator('main a[href="/porcelanato/cotizar"]').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Prefiero escribir por WhatsApp' })).toHaveAttribute('href', /wa\.me/);
  });

  test('tells what to install and sees it summed up before sending', async ({ page }) => {
    await mockGooglePlaces(page);

    await page.goto(TILE_FORM, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: '¿Dónde hay que instalar?' })).toBeVisible();
    await pickAddress(page, 'Av. Pardo 610, Miraflores, Lima, Perú');
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // Sin descripción ni video no avanza.
    await expect(page.getByRole('heading', { name: '¿Qué quieres instalar?' })).toBeVisible();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByRole('alert')).toContainText('Cuéntanos qué hay que instalar');

    await page.fill('#tiling-description', 'Porcelanato en sala y cocina. Sacar la cerámica actual.');
    await page.getByText('Porcelanato', { exact: true }).click();
    await page.getByText('Piso', { exact: true }).click();
    await page.getByText('Sala y comedor', { exact: true }).click();
    await page.getByText('Cocina', { exact: true }).click();
    await page.fill('#tiling-m2', '35');
    await page.getByText('60×120 o más grande', { exact: true }).click();
    await page.getByText('Sí, hay que sacar el piso actual', { exact: true }).click();
    await page.getByRole('button', { name: 'Siguiente' }).click();

    await expect(page.getByRole('heading', { name: '¿Cuándo lo necesitas?' })).toBeVisible();
    await expect(page.getByText('Porcelanato en sala y cocina. Sacar la cerámica actual.')).toBeVisible();
    await expect(page.getByText(
      'Porcelanato · Piso · sala y comedor, cocina · 35 m² · Formato: 60×120 o más grande · Hay que sacar el piso actual',
    )).toBeVisible();

    await page.evaluate(() => localStorage.removeItem('chalan_masonry_request'));
  });
});
