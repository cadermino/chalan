const { execSync } = require('child_process');
const { expect } = require('@playwright/test');

const TEST_DATA = {
  from: {
    street: 'Av. Javier Prado Este 4600, Santiago de Surco, Lima, Perú',
    floor: 3,
    parkingDistance: 5,
    hasElevator: '1',
    zipCode: '15023',
    country: 'Perú',
    mapUrl: 'https://maps.google.com/?q=Av.+Javier+Prado+Este+4600',
  },
  to: {
    street: 'Av. Arequipa 2450, Lince, Lima, Perú',
    floor: 2,
    parkingDistance: 10,
    hasElevator: '0',
    zipCode: '15046',
    country: 'Perú',
    mapUrl: 'https://maps.google.com/?q=Av.+Arequipa+2450',
  },
  stepTwo: {
    appointmentDate: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d.toISOString().slice(0, 10) + ' 10:00:00';
    })(),
    items: ['1 cama matrimonial', '1 sofá 3 cuerpos', '2 sillas de comedor'],
    cargo: '1',
    packaging: '0',
    approximateBudget: 500,
  },
};

/**
 * Injects address data into the Vuex store, bypassing Google Places API.
 * Vue 2 exposes the instance on the DOM element as __vue__.
 */
async function injectAddressToStore(page, direction, data) {
  const section = direction === 'from' ? 'orderDetailsOrigin' : 'orderDetailsDestination';
  const prefix = direction;

  await page.evaluate(({ section: s, prefix: p, addr }) => {
    const store = document.querySelector('#app').__vue__.$store;
    store.commit('setOrder', { section: s, field: `${p}_street`, value: addr.street });
    store.commit('setOrder', { section: s, field: `${p}_zip_code`, value: addr.zipCode });
    store.commit('setOrder', { section: s, field: `${p}_country`, value: addr.country });
    store.commit('setOrder', { section: s, field: `${p}_map_url`, value: addr.mapUrl });
  }, { section, prefix, addr: data });
}

/**
 * An anonymous, first-time step-one submission shows the optional
 * lead-phone modal (frontend/src/views/order/Step-one.vue) before
 * navigating to step-two. Dismiss it so flows that don't care about lead
 * capture behave like before it existed.
 */
async function dismissLeadPhoneModalIfPresent(page) {
  try {
    await page.waitForSelector('button:has-text("Omitir por ahora")', { state: 'visible', timeout: 8000 });
    await page.click('button:has-text("Omitir por ahora")');
  } catch {
    // Modal never appeared (e.g. already prompted this session) — nothing to dismiss.
  }
}

async function fillStepOne(page) {
  await page.goto('/order/step-one', { waitUntil: 'networkidle' });
  await page.waitForSelector('#address-from-street', { timeout: 30000 });

  await page.fill('#address-from-street', TEST_DATA.from.street);
  await injectAddressToStore(page, 'from', TEST_DATA.from);
  await page.selectOption('#address-from-floor', { index: TEST_DATA.from.floor });
  await page.fill('#from-parking-distance', String(TEST_DATA.from.parkingDistance));
  await page.setChecked('#from-has-elevator-checkbox', TEST_DATA.from.hasElevator === '1');

  await page.fill('#address-to-street', TEST_DATA.to.street);
  await injectAddressToStore(page, 'to', TEST_DATA.to);
  await page.selectOption('#address-to-floor', { index: TEST_DATA.to.floor });
  await page.fill('#to-parking-distance', String(TEST_DATA.to.parkingDistance));
  await page.setChecked('#to-has-elevator-checkbox', TEST_DATA.to.hasElevator === '1');

  await page.click('button:has-text("Guardar y continuar")');
  await dismissLeadPhoneModalIfPresent(page);
  await expect(page).toHaveURL(/step-two/, { timeout: 15000 });
}

async function fillStepTwo(page) {
  await page.evaluate((date) => {
    const store = document.querySelector('#app').__vue__.$store;
    store.commit('setOrder', { section: 'currentOrder', field: 'appointment_date', value: date });
  }, TEST_DATA.stepTwo.appointmentDate);

  for (const item of TEST_DATA.stepTwo.items) {
    await page.fill('input[placeholder="Ej: 1 cama matrimonial"]', item);
    await page.click('button:has-text("+ Agregar")');
  }

  // Unchecked is a valid "No" by default, so only click to opt in.
  if (TEST_DATA.stepTwo.cargo === '1') {
    await page.click('#cargo-service');
  }
  if (TEST_DATA.stepTwo.packaging === '1') {
    await page.click('#packaging-service');
  }
  await page.fill('#approximate-budget', String(TEST_DATA.stepTwo.approximateBudget));

  await page.click('button:has-text("Siguiente")');
  await expect(page).toHaveURL(/step-three/, { timeout: 15000 });
}

/**
 * Step-three/step-four require an authenticated customer. Registers a brand
 * new account from wherever the auth redirect landed (?redirect=... is
 * preserved), which lands back on the originating step on success.
 */
async function registerAndReturn(page) {
  await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  await page.click('text=Registrate.');
  await expect(page).toHaveURL(/\/register/, { timeout: 15000 });

  const unique = Date.now();
  await page.fill('#email', `e2e-${unique}@example.com`);
  await page.fill('#mobilePhone', '987654321');
  await page.fill('#name', 'Cliente E2E');
  await page.fill('#password', 'Test-password-1');
  await page.click('button:has-text("Registrame")');

  await expect(page).toHaveURL(/step-three/, { timeout: 15000 });
}

/**
 * Seeds a carrier company + vehicle + quotation directly in Postgres so
 * step-three has a real quote to select, without going through the real
 * create_quotation endpoint (which sends live email/WhatsApp notifications).
 */
function seedQuotation(orderId) {
  const sql = `
    INSERT INTO carrier_company (name, email, active, country_id)
    VALUES ('E2E Test Carrier', 'carlos.calderon@chalan.pe', 1, 1)
    RETURNING id;
  `;
  const carrierId = execSync(
    `docker exec chalan-db-1 psql -U chalan_user -d chalan -tAc "${sql.replace(/\n/g, ' ')}"`,
  ).toString().trim().split('\n')[0];

  execSync(
    `docker exec chalan-db-1 psql -U chalan_user -d chalan -c "` +
    `INSERT INTO vehicles (carrier_company_id, size, weight, brand, model, active) ` +
    `VALUES (${carrierId}, 'medium', '1000', 'Hyundai', 'H100', 1);"`,
  );

  execSync(
    `docker exec chalan-db-1 psql -U chalan_user -d chalan -c "` +
    `INSERT INTO quotations (amount, order_id, carrier_company_id) ` +
    `VALUES (450, ${orderId}, ${carrierId});"`,
  );

  return carrierId;
}

function getOrderIdFromStore(page) {
  return page.evaluate(() => document.querySelector('#app').__vue__.$store.state.currentOrder.order_id);
}

/**
 * Replaces window.google.maps with a fake implementation before any page
 * script runs, so SearchBoxPlacesApiGoogle.vue's real code path (loadGoogle
 * -> initMap -> new google.maps.places.SearchBox(input)) runs unmodified,
 * but never touches Google's real network/API. Google's Maps JS SDK doesn't
 * expose its autocomplete traffic as plain interceptable HTTP calls, so
 * stubbing the SDK surface is the reliable way to drive this without a
 * real API key or live network dependency.
 */
async function mockGooglePlaces(page) {
  await page.addInitScript(() => {
    class FakeSearchBox {
      constructor(input) {
        this._listeners = {};
        window.__searchBoxes = window.__searchBoxes || {};
        window.__searchBoxes[input.id] = this;
      }

      setBounds() {}

      addListener(event, cb) {
        this._listeners[event] = cb;
      }

      getPlaces() {
        return this._places || [];
      }

      __select(place) {
        this._places = [place];
        if (this._listeners.places_changed) this._listeners.places_changed();
      }
    }

    window.google = {
      maps: {
        Map: class { addListener() {} getBounds() { return null; } fitBounds() {} },
        Marker: class { setMap() {} },
        Size: class {},
        Point: class {},
        LatLngBounds: class { union() {} extend() {} },
        places: {
          SearchBox: FakeSearchBox,
          PlacesServiceStatus: { OK: 'OK' },
          PlacesService: class {
            findPlaceFromQuery(_opts, cb) { cb([], 'ZERO_RESULTS'); }
          },
        },
      },
    };
  });
}

/**
 * Builds a Google Places "place" object shaped like a real Places API
 * response, then simulates the user picking it from the autocomplete
 * dropdown for the given input (must call mockGooglePlaces(page) first).
 */
async function selectMockAddress(page, inputId, { formattedAddress, zipCode, country, mapUrl }) {
  const place = {
    formatted_address: formattedAddress,
    url: mapUrl,
    name: formattedAddress,
    geometry: { location: {} },
    address_components: [
      { long_name: zipCode, short_name: zipCode, types: ['postal_code'] },
      { long_name: country, short_name: country, types: ['country'] },
    ],
  };

  await page.waitForFunction(
    (id) => window.__searchBoxes && window.__searchBoxes[id],
    inputId,
    { timeout: 15000 },
  );
  await page.evaluate(({ id, p }) => {
    // Google's real widget also writes the picked description into the
    // input (dispatching a native 'input' event, which is what v-model
    // listens for) before firing places_changed. Mirror that here.
    const input = document.getElementById(id);
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, p.formatted_address);
    input.dispatchEvent(new Event('input', { bubbles: true }));

    window.__searchBoxes[id].__select(p);
  }, { id: inputId, p: place });
}

module.exports = {
  TEST_DATA,
  injectAddressToStore,
  dismissLeadPhoneModalIfPresent,
  fillStepOne,
  fillStepTwo,
  registerAndReturn,
  seedQuotation,
  getOrderIdFromStore,
  mockGooglePlaces,
  selectMockAddress,
};
