const { test, expect } = require('@playwright/test');
const {
  mockGooglePlaces, uniqueOperationNumber, openBackofficeAsAdmin, seedServiceRequest, seedServiceQuotation,
  findServiceRequestByWhatsapp, getServiceRequestStatus, getServiceRequestPublicId, cleanupSeededServiceRequests, psql,
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

/** Pasado mañana en Lima, YYYY-MM-DD (el formulario no acepta hoy). */
function inTwoDaysInLima() {
  const date = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(date);
}

/**
 * Elige pasado mañana en el calendario del paso de contacto (DateField.jsx). El
 * campo es de solo lectura, como el día del paso 2 de mudanzas: se abre y se
 * toca el día. Si cae en el mes siguiente, ese número en el mes que se ve ya
 * pasó (desactivado), y se pasa de mes.
 */
async function pickDay(page) {
  const day = String(Number(inTwoDaysInLima().slice(8)));
  await page.click('#preferred-date');
  const calendar = page.locator('.chalan-calendar');
  await expect(calendar).toBeVisible();
  const target = calendar
    .locator('.react-datepicker__day:not(.react-datepicker__day--outside-month):not(.react-datepicker__day--disabled)')
    .getByText(day, { exact: true });
  if (await target.count() === 0) await calendar.locator('.react-datepicker__navigation--next').click();
  await target.click();
  await expect(page.locator('#preferred-date')).not.toHaveValue('');
}

/** Nueve dígitos que empiezan con 9, distintos en cada corrida: así se encuentra el servicio. */
function uniqueWhatsapp() {
  return `9${String(Date.now()).slice(-8)}`;
}

/**
 * Elige una dirección del autocompletado falso de Google (mockGooglePlaces), en
 * el campo de dirección o, con `inputId`, en otro (el destino del armado).
 */
async function pickAddress(page, formatted, inputId = 'address-street') {
  await page.waitForFunction(
    (id) => (window.__autocompleteInstances || []).some((entry) => entry.input.id === id),
    inputId,
    { timeout: 15000 },
  );
  await page.evaluate(([address, id]) => {
    const entry = window.__autocompleteInstances.find((e) => e.input.id === id);
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
  }, [formatted, inputId]);
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
    await pickDay(page);
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
    await pickDay(page);
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

// Microcemento: como porcelanato, más qué hay debajo y si el material va
// incluido. Tampoco se envía, por la misma empresa de prueba (lo cubren los
// tests del API, test_a_microcement_request_...).
test.describe('A microcement customer', () => {
  const MICROCEMENT_FORM = '/microcemento/cotizar';

  test('the landing sends them to the form, WhatsApp stays as a second option', async ({ page }) => {
    await page.goto('/microcemento', { waitUntil: 'networkidle' });

    await expect(page.locator('main a[href="/microcemento/cotizar"]').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Prefiero escribir por WhatsApp' })).toHaveAttribute('href', /wa\.me/);
  });

  test('tells where it goes and sees it summed up before sending', async ({ page }) => {
    await mockGooglePlaces(page);

    await page.goto(MICROCEMENT_FORM, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: '¿Dónde hay que aplicar el microcemento?' })).toBeVisible();
    await pickAddress(page, 'Av. Pardo 610, Miraflores, Lima, Perú');
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // Sin descripción ni video no avanza.
    await expect(page.getByRole('heading', { name: '¿Dónde va el microcemento?' })).toBeVisible();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByRole('alert')).toContainText('Cuéntanos dónde va el microcemento');

    await page.fill('#microcement-description', 'El baño completo, sobre la mayólica que está.');
    await page.getByText('Piso y pared', { exact: true }).click();
    await page.getByText('Baños y duchas', { exact: true }).click();
    await page.fill('#microcement-m2', '18');
    await page.getByText('Cerámica, mayólica o porcelanato', { exact: true }).click();
    await page.getByText('Humedad', { exact: true }).click();
    await page.getByText('A todo costo, que lo incluya el aplicador', { exact: true }).click();
    await page.getByRole('button', { name: 'Siguiente' }).click();

    await expect(page.getByRole('heading', { name: '¿Cuándo lo necesitas?' })).toBeVisible();
    await expect(page.getByText('El baño completo, sobre la mayólica que está.')).toBeVisible();
    await expect(page.getByText(
      'Piso y pared · baños y duchas · 18 m² · Hoy: cerámica, mayólica o porcelanato · Base: humedad · '
      + 'Material: a todo costo, que lo incluya el aplicador',
    )).toBeVisible();

    await page.evaluate(() => localStorage.removeItem('chalan_microcement_request'));
  });
});

// Armado y desarmado: cada mueble dice qué hacer con él. "Desarmar y armar"
// pide dónde se arma: otra dirección (con el mismo buscador y mapa que la
// dirección) o, con la casilla, la misma, en otro piso o ambiente. Sin
// armadores locales con el servicio marcado, enviar solo avisa al admin.
test.describe('A furniture assembly customer', () => {
  const FURNITURE_FORM = '/armado/cotizar';

  /** Los details que guardó el API, como objeto. */
  const savedDetails = (id) => JSON.parse(psql(`SELECT details::text FROM service_requests WHERE id = ${id};`));

  /** Paso 1 y un ropero que se desarma acá y se arma en otro lado. */
  async function startWithAWardrobeToMove(page) {
    await mockGooglePlaces(page);
    await page.goto(FURNITURE_FORM, { waitUntil: 'networkidle' });
    await pickAddress(page, 'Av. Larco 345, Miraflores, Lima, Perú');
    await page.getByRole('button', { name: 'Siguiente' }).click();

    await expect(page.getByRole('heading', { name: '¿Qué muebles son?' })).toBeVisible();
    await page.getByRole('button', { name: '+ Ropero' }).click();
    // Sin elegir qué hacer no avanza.
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByText('Falta elegir qué hacer con algún mueble.')).toBeVisible();
    await page.getByText('Desarmar y armar', { exact: true }).click();
    await expect(page.getByRole('heading', { name: '¿Dónde se arman?' })).toBeVisible();
  }

  async function sendContact(page, whatsapp) {
    await pickDay(page);
    await page.fill('#customer-name', 'Carla');
    await page.fill('#whatsapp', whatsapp);
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();
    await expect(page.getByRole('heading', { name: '¡Recibimos tu solicitud!' })).toBeVisible({ timeout: 15000 });
    return findServiceRequestByWhatsapp(`+51${whatsapp}`);
  }

  test('only pieces put together elsewhere ask where', async ({ page }) => {
    await mockGooglePlaces(page);
    await page.goto(FURNITURE_FORM, { waitUntil: 'networkidle' });
    await pickAddress(page, 'Av. Larco 345, Miraflores, Lima, Perú');
    await page.getByRole('button', { name: 'Siguiente' }).click();

    await page.getByRole('button', { name: '+ Escritorio' }).click();
    await page.getByText('Armar', { exact: true }).click();
    await expect(page.getByRole('heading', { name: '¿Dónde se arman?' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Siguiente' }).click();

    await expect(page.getByRole('heading', { name: '¿Cuándo lo necesitas?' })).toBeVisible();
    await expect(page.getByText('1 × Escritorio')).toBeVisible();
    await expect(page.getByText('Se arman en')).toHaveCount(0);

    await page.evaluate(() => localStorage.removeItem('chalan_furniture_assembly_request'));
  });

  test('taken apart and put together at the same address, on another floor', async ({ page }) => {
    await startWithAWardrobeToMove(page);

    // La casilla esconde la dirección de destino y su mapa; el piso queda.
    await page.getByRole('checkbox', { name: /Se arman en la misma dirección/ }).check();
    await expect(page.locator('#destination-street')).toHaveCount(0);
    await expect(page.locator('#destination-map')).toHaveCount(0);

    // Un teléfono en el piso no pasa: lo leen todas las empresas.
    await page.fill('#destination-floor', '1.er piso, llamar al 987 654 321');
    await expect(page.getByText('Quita el número de teléfono').first()).toBeVisible();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByRole('heading', { name: '¿Qué muebles son?' })).toBeVisible();

    await page.fill('#destination-floor', '1.er piso, dormitorio del fondo');
    await page.getByRole('button', { name: 'Siguiente' }).click();

    await expect(page.getByRole('heading', { name: '¿Cuándo lo necesitas?' })).toBeVisible();
    await expect(page.getByText('1 × Ropero')).toBeVisible();
    await expect(page.getByText('La misma dirección · 1.er piso, dormitorio del fondo')).toBeVisible();

    // Volver al paso 2 la mantiene marcada.
    await page.goBack();
    await expect(page.getByRole('checkbox', { name: /Se arman en la misma dirección/ })).toBeChecked();
    await expect(page.locator('#destination-floor')).toHaveValue('1.er piso, dormitorio del fondo');
    await page.getByRole('button', { name: 'Siguiente' }).click();

    const request = await sendContact(page, uniqueWhatsapp());
    expect(savedDetails(request.id)).toEqual({ same_address: true, destination_floor: '1.er piso, dormitorio del fondo' });

    // El admin (y el armador) lo ven en el detalle.
    const admin = await page.context().newPage();
    await openBackofficeAsAdmin(admin, `/service-requests/${request.id}`);
    await expect(admin.getByText('Dónde se arman', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(admin.getByText('Piso o ambiente: 1.er piso, dormitorio del fondo')).toBeVisible();
    await expect(admin.getByText('Dirección (dónde se desarman)')).toBeVisible();
  });

  test('taken apart here and put together at another address', async ({ page }) => {
    await startWithAWardrobeToMove(page);

    // Sin destino no avanza.
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByText('No encontramos esta dirección en el mapa.')).toBeVisible();

    await pickAddress(page, 'Av. Primavera 1050, Santiago de Surco, Lima, Perú', 'destination-street');
    await expect(page.getByText('✓ Dirección confirmada')).toBeVisible();
    await page.fill('#destination-floor', '3.er piso');
    await page.getByRole('button', { name: 'Siguiente' }).click();

    await expect(page.getByRole('heading', { name: '¿Cuándo lo necesitas?' })).toBeVisible();
    await expect(page.getByText('Av. Primavera 1050, Santiago de Surco, Lima, Perú · 3.er piso')).toBeVisible();

    const request = await sendContact(page, uniqueWhatsapp());
    const details = savedDetails(request.id);
    expect(details.destination.street).toBe('Av. Primavera 1050, Santiago de Surco, Lima, Perú');
    expect(details.destination_floor).toBe('3.er piso');
    expect(details.same_address).toBeUndefined();

    const admin = await page.context().newPage();
    await openBackofficeAsAdmin(admin, `/service-requests/${request.id}`);
    await expect(admin.getByText('Destino (dónde se arman)')).toBeVisible({ timeout: 15000 });
    await expect(admin.getByText('Piso o ambiente: 3.er piso')).toBeVisible();
  });
});
