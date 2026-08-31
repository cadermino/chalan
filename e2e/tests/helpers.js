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

/**
 * Creates a real backend order via the same two API calls Step-one.vue and
 * Step-two.vue make (POST /order then PUT /order/<id>), then injects the
 * resulting state straight into the live Vuex store and navigates through
 * the SPA's own router - skipping the address/belongings forms entirely for
 * tests that only care about what happens afterward.
 *
 * upTo controls how far the order is pre-filled: 'step-two' (default)
 * includes appointment/items/services and lands on step-three; 'step-one'
 * stops at the address data (no PUT) and lands on step-two, for tests that
 * exercise step-two's own UI.
 *
 * Must commit into the store (not localStorage) and navigate via the app's
 * own $router, not page.goto(): a goto() would hard-reload and wipe the
 * in-memory state we just injected, since none of it went through
 * localStorage the way real form input does.
 */
async function createOrderViaApi(page, { upTo = 'step-two' } = {}) {
  const orderDetailsOrigin = {
    from_street: TEST_DATA.from.street,
    from_zip_code: TEST_DATA.from.zipCode,
    from_country: TEST_DATA.from.country,
    from_map_url: TEST_DATA.from.mapUrl,
    from_floor_number: TEST_DATA.from.floor,
    from_approximate_distance_from_parking: TEST_DATA.from.parkingDistance,
    from_has_elevator: TEST_DATA.from.hasElevator,
  };
  const orderDetailsDestination = {
    to_street: TEST_DATA.to.street,
    to_zip_code: TEST_DATA.to.zipCode,
    to_country: TEST_DATA.to.country,
    to_map_url: TEST_DATA.to.mapUrl,
    to_floor_number: TEST_DATA.to.floor,
    to_approximate_distance_from_parking: TEST_DATA.to.parkingDistance,
    to_has_elevator: TEST_DATA.to.hasElevator,
  };

  const createRes = await page.request.post('/api/v1/order', {
    data: { orderDetailsOrigin, orderDetailsDestination, customer: { customer_id: null }, referral_code: null },
  });
  const { order_id: orderId } = await createRes.json();

  const includeStepTwo = upTo === 'step-two';
  if (includeStepTwo) {
    await page.request.put(`/api/v1/order/${orderId}`, {
      data: {
        order: {
          order_id: orderId,
          appointment_date: TEST_DATA.stepTwo.appointmentDate,
          comments: TEST_DATA.stepTwo.items.join('\n'),
          approximate_budget: TEST_DATA.stepTwo.approximateBudget,
        },
        orderDetailsOrigin,
        orderDetailsDestination,
        services: { packaging: TEST_DATA.stepTwo.packaging, cargo: TEST_DATA.stepTwo.cargo },
        customer: { customer_id: null },
      },
    });
  }

  await page.goto('/order/step-one', { waitUntil: 'networkidle' });
  await page.waitForSelector('#address-from-street', { timeout: 30000 });

  await page.evaluate(({
    id, from, to, stepTwoData,
  }) => {
    const { $store: store, $router: router } = document.querySelector('#app').__vue__;
    store.commit('setOrder', { section: 'currentOrder', field: 'order_id', value: id });
    Object.entries(from).forEach(([field, value]) => {
      store.commit('setOrder', { section: 'orderDetailsOrigin', field, value });
    });
    Object.entries(to).forEach(([field, value]) => {
      store.commit('setOrder', { section: 'orderDetailsDestination', field, value });
    });
    if (stepTwoData) {
      store.commit('setOrder', { section: 'currentOrder', field: 'appointment_date', value: stepTwoData.appointmentDate });
      store.commit('setOrder', { section: 'currentOrder', field: 'comments', value: stepTwoData.items.join('\n') });
      store.commit('setOrder', { section: 'currentOrder', field: 'approximate_budget', value: stepTwoData.approximateBudget });
      store.commit('setOrder', { section: 'services', field: 'packaging', value: stepTwoData.packaging });
      store.commit('setOrder', { section: 'services', field: 'cargo', value: stepTwoData.cargo });
    }
    router.push({ name: stepTwoData ? 'step-three' : 'step-two' });
  }, {
    id: orderId,
    from: orderDetailsOrigin,
    to: orderDetailsDestination,
    stepTwoData: includeStepTwo ? TEST_DATA.stepTwo : null,
  });

  return orderId;
}

/**
 * Step-three requires an authenticated customer. Registers a brand new
 * account from wherever the auth redirect landed (?redirect=... is
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
 *
 * Also fakes google.maps.places.Autocomplete, which is what the Next.js
 * QuoteWidget (frontend-react/src/components/QuoteWidget.tsx) uses instead
 * of SearchBox. Instances are tracked in window.__autocompleteInstances
 * (an array, not keyed by id) since QuoteWidget's inputs don't have ids and
 * a single page can render more than one widget instance.
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

    class FakeAutocomplete {
      constructor(input) {
        this._listeners = {};
        window.__autocompleteInstances = window.__autocompleteInstances || [];
        window.__autocompleteInstances.push({ input, instance: this });
      }

      addListener(event, cb) {
        this._listeners[event] = cb;
      }

      getPlace() {
        return this._place || {};
      }

      __select(place) {
        this._place = place;
        if (this._listeners.place_changed) this._listeners.place_changed();
      }
    }

    window.google = {
      maps: {
        Map: class { addListener() {} getBounds() { return null; } fitBounds() {} },
        Marker: class { setMap() {} },
        Size: class {},
        Point: class {},
        LatLngBounds: class { union() {} extend() {} },
        Geocoder: class {
          geocode(_opts, cb) { cb([], 'ZERO_RESULTS'); }
        },
        places: {
          SearchBox: FakeSearchBox,
          Autocomplete: FakeAutocomplete,
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

/**
 * Same idea as selectMockAddress, but for google.maps.places.Autocomplete
 * (the Next.js QuoteWidget's autocomplete input), whose inputs are located
 * by placeholder text since they don't have ids. lat/lng are passed
 * separately because functions can't cross the page.evaluate boundary, so
 * geometry.location.lat()/lng() are built inside the browser context.
 */
async function selectMockAutocompleteAddress(page, placeholder, {
  formattedAddress, zipCode, country, mapUrl, lat, lng,
}) {
  // QuoteWidget defers loading the Google Places script (and constructing
  // Autocomplete) until the input is focused, so __autocompleteInstances
  // won't exist until we interact with the field first - same as a real user.
  await page.getByPlaceholder(placeholder).click();

  await page.waitForFunction(
    (ph) => window.__autocompleteInstances
      && window.__autocompleteInstances.some((entry) => entry.input.placeholder === ph),
    placeholder,
    { timeout: 15000 },
  );

  await page.evaluate(({ ph, formattedAddressArg, zipCodeArg, countryArg, mapUrlArg, latArg, lngArg }) => {
    const entry = window.__autocompleteInstances.find((e) => e.input.placeholder === ph);
    const { input } = entry;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, formattedAddressArg);
    input.dispatchEvent(new Event('input', { bubbles: true }));

    entry.instance.__select({
      formatted_address: formattedAddressArg,
      url: mapUrlArg,
      address_components: [
        { long_name: zipCodeArg, short_name: zipCodeArg, types: ['postal_code'] },
        { long_name: countryArg, short_name: countryArg, types: ['country'] },
      ],
      geometry: { location: { lat: () => latArg, lng: () => lngArg } },
    });
  }, {
    ph: placeholder,
    formattedAddressArg: formattedAddress,
    zipCodeArg: zipCode,
    countryArg: country,
    mapUrlArg: mapUrl,
    latArg: lat,
    lngArg: lng,
  });
}

module.exports = {
  TEST_DATA,
  injectAddressToStore,
  dismissLeadPhoneModalIfPresent,
  createOrderViaApi,
  registerAndReturn,
  seedQuotation,
  getOrderIdFromStore,
  mockGooglePlaces,
  selectMockAddress,
  selectMockAutocompleteAddress,
};
