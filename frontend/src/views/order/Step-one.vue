<template>
  <div>
    <div class="flex flex-wrap">
      <div class="w-full mb-4">
        <Tracker :current-view="viewName"></Tracker>
        <div class="
          w-full
          max-w-6xl
          mx-auto
          px-8
          ">
          <form class="bg-white pb-8 sm:p-0 p-5 sm:pb-8">
            <ViewsMessages :view-name="viewName"/>
            <p class="text-center font-bold mb-4">
              ¿Qué vas a transportar?
            </p>
            <div id="load-type" class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
              <button v-for="option in loadTypes"
                :key="option.value"
                type="button"
                :data-load-type="option.value"
                :aria-pressed="loadType === option.value"
                @click="loadType = option.value"
                class="border-2 rounded-lg px-3 py-3 text-left
                  focus:outline-none focus:shadow-outline"
                :class="loadType === option.value
                  ? 'border-green-500 bg-green-100'
                  : 'border-gray-300 hover:border-gray-400'">
                <span class="block text-sm font-bold text-gray-700">{{ option.label }}</span>
                <span class="block text-xs text-gray-500">{{ option.hint }}</span>
              </button>
            </div>
            <p class="text-center font-bold mb-10">
              Dirección de donde vamos a recoger tus cosas
            </p>
            <div class="flex flex-wrap">
              <div class="flex
                flex-wrap
                content-start
                -mx-3
                mb-4
                md:w-1/2">
                <div class="w-full px-3 mb-4">
                  <label class="block
                    text-gray-700
                    text-sm
                    font-bold mb-2" for="address-from-street">
                        Calle y número <span class="text-red-500">*</span>
                  </label>
                  <input :class="formValidationMessages['from_street']
                  ?'border-red-300':''"
                  class="appearance-none
                    border rounded
                    w-full
                    py-2
                    px-3
                    text-gray-700
                    leading-tight
                    focus:outline-none
                    focus:border-blue-400"
                    v-model="selectedFromStreet"
                    id="address-from-street"
                    :placeholder="countryData.fromStreetPlaceholder"
                    type="text"
                    autocomplete="on">
                  <p v-if="formValidationMessages['from_street']"
                    class="text-red-500
                    text-xs
                    italic">{{ formValidationMessages['from_street'] }}.</p>
                </div>
                <div class="w-full md:w-1/2 px-3 mb-4">
                  <label class="block
                  text-gray-700
                  text-sm
                  font-bold mb-2" for="address-from-floor">
                      {{ floorLabel }} <span class="text-red-500">*</span>
                  </label>
                  <div class="relative">
                    <select
                    :class="formValidationMessages['from_floor_number']
                    ?'border-red-300':''"
                    class="appearance-none
                    border
                    bg-white
                    rounded
                    w-full
                    py-2
                    px-3
                    text-gray-700
                    leading-tight
                    focus:outline-none
                    focus:border-blue-400"
                    id="address-from-floor"
                    v-model="selectedFromFloor">
                      <option disabled value="">Selecciona un piso</option>
                      <option
                      v-for="option in countryData.floor"
                      v-bind:value="option.value"
                      v-bind:key="option.value">
                        {{ option.label }}
                      </option>
                    </select>
                    <div class="pointer-events-none
                        absolute
                        inset-y-0
                        right-0
                        flex
                        items-center
                        px-2
                        text-gray-700">
                    <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                  <p v-if="formValidationMessages['from_floor_number']"
                  class="text-red-500
                  text-xs
                  italic">{{ formValidationMessages['from_floor_number'] }}.</p>
                </div>
                <div class="w-full md:w-1/2 px-3 mb-4">
                  <label class="block
                    text-gray-700
                    text-sm
                    font-bold mb-2" for="from-parking-distance">
                      ¿Dónde se estaciona el camión?<span class="text-red-500">*</span>
                  </label>
                  <div class="relative">
                    <select
                    :class="formValidationMessages['from_approximate_distance_from_parking']
                    ?'border-red-300':''"
                    class="appearance-none
                    border
                    bg-white
                    rounded
                    w-full
                    py-2
                    px-3
                    text-gray-700
                    leading-tight
                    focus:outline-none
                    focus:border-blue-400"
                    id="from-parking-distance"
                    v-model="fromParkingDistance">
                      <option
                      v-for="option in parkingOptions(fromParkingDistance)"
                      v-bind:value="option.value"
                      v-bind:key="option.value">
                        {{ option.label }}
                      </option>
                    </select>
                    <div class="pointer-events-none
                        absolute
                        inset-y-0
                        right-0
                        flex
                        items-center
                        px-2
                        text-gray-700">
                    <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                  <p v-if="formValidationMessages['from_approximate_distance_from_parking']"
                    class="text-red-500
                    text-xs
                    italic">
                    {{ formValidationMessages['from_approximate_distance_from_parking'] }}.
                  </p>
                </div>
                <div id="from-has-elevator" class="w-full px-3 mb-4">
                  <label class="block
                    text-gray-700
                    text-sm
                    font-bold mb-2">
                      El edificio cuenta con elevador?
                  </label>
                  <div class="flex items-center">
                    <input type="checkbox"
                      class="w-4 h-4 rounded border-gray-300"
                      style="accent-color: #63b3ed"
                      id="from-has-elevator-checkbox"
                      v-model="fromHasElevator"
                      true-value="1"
                      false-value="0" />
                    <label class="ml-2" for="from-has-elevator-checkbox">
                      Sí, cuenta con elevador
                    </label>
                  </div>
                  <p v-if="formValidationMessages['from_has_elevator']"
                    class="text-red-500
                    text-xs
                    italic">
                    {{ formValidationMessages['from_has_elevator'] }}.
                  </p>
                </div>
              </div>
              <div class="md:w-1/2 w-full md:ml-6">
                <SearchBoxPlacesApiGoogle
                  :api-key="placesApiKey"
                  v-on:google-address="fillAddress"
                  input-id="address-from-street"
                  map-id="address-from-map"
                  :initial-address="orderDetailsOrigin.from_street"
                />
              </div>
            </div>
            <div class="border-b border-1 my-10"></div>
            <p class="text-center font-bold mb-10">Dirección de destino</p>

            <div class="flex flex-wrap">
              <div class="
                flex
                flex-wrap
                content-start
                -mx-3
                mb-4
                md:w-1/2">
                <div class="w-full px-3 mb-4">
                    <label class="block
                      text-gray-700
                      text-sm
                      font-bold mb-2" for="address-to-street">
                          Calle y número <span class="text-red-500">*</span>
                    </label>
                    <input :class="formValidationMessages['to_street']
                    ?'border-red-300':''"
                    class="appearance-none
                      border rounded
                      w-full
                      py-2
                      px-3
                      text-gray-700
                      leading-tight
                      focus:outline-none
                      focus:border-blue-400"
                      v-model="selectedToStreet"
                      id="address-to-street"
                      :placeholder="countryData.toStreetPlaceholder"
                      type="text"
                      autocomplete="on">
                    <p v-if="formValidationMessages['to_street']"
                      class="text-red-500
                      text-xs
                      italic">{{ formValidationMessages['to_street'] }}.</p>
                </div>
                <div class="w-full md:w-1/2 px-3 mb-4">
                  <label class="block
                  text-gray-700
                  text-sm
                  font-bold mb-2" for="address-to-floor">
                      {{ floorLabel }} <span class="text-red-500">*</span>
                  </label>
                  <div class="relative">
                    <select
                    :class="formValidationMessages['to_floor_number']
                    ?'border-red-300':''"
                    class="appearance-none
                    border
                    bg-white
                    rounded
                    w-full
                    py-2
                    px-3
                    text-gray-700
                    leading-tight
                    focus:outline-none
                    focus:border-blue-400"
                    id="address-to-floor"
                    v-model="selectedToFloor">
                      <option disabled value="">Selecciona un piso</option>
                      <option
                      v-for="option in countryData.floor"
                      v-bind:value="option.value"
                      v-bind:key="option.value">
                        {{ option.label }}
                      </option>
                    </select>
                    <div class="pointer-events-none
                        absolute
                        inset-y-0
                        right-0
                        flex
                        items-center
                        px-2
                        text-gray-700">
                    <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                  <p v-if="formValidationMessages['to_floor_number']"
                  class="text-red-500
                  text-xs
                  italic">{{ formValidationMessages['to_floor_number'] }}.</p>
                </div>
                <div class="w-full md:w-1/2 px-3 mb-4">
                  <label class="block
                    text-gray-700
                    text-sm
                    font-bold mb-2" for="to-parking-distance">
                      ¿Dónde se estaciona el camión?<span class="text-red-500">*</span>
                  </label>
                  <div class="relative">
                    <select
                    :class="formValidationMessages['to_approximate_distance_from_parking']
                    ?'border-red-300':''"
                    class="appearance-none
                    border
                    bg-white
                    rounded
                    w-full
                    py-2
                    px-3
                    text-gray-700
                    leading-tight
                    focus:outline-none
                    focus:border-blue-400"
                    id="to-parking-distance"
                    v-model="toParkingDistance">
                      <option
                      v-for="option in parkingOptions(toParkingDistance)"
                      v-bind:value="option.value"
                      v-bind:key="option.value">
                        {{ option.label }}
                      </option>
                    </select>
                    <div class="pointer-events-none
                        absolute
                        inset-y-0
                        right-0
                        flex
                        items-center
                        px-2
                        text-gray-700">
                    <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                  <p v-if="formValidationMessages['to_approximate_distance_from_parking']"
                    class="text-red-500
                    text-xs
                    italic">
                    {{ formValidationMessages['to_approximate_distance_from_parking'] }}.
                  </p>
                </div>
                <div id="to-has-elevator" class="w-full px-3 mb-4">
                  <label class="block
                    text-gray-700
                    text-sm
                    font-bold mb-2">
                      El edificio cuenta con elevador?
                  </label>
                  <div class="flex items-center">
                    <input type="checkbox"
                      class="w-4 h-4 rounded border-gray-300"
                      style="accent-color: #63b3ed"
                      id="to-has-elevator-checkbox"
                      v-model="toHasElevator"
                      true-value="1"
                      false-value="0" />
                    <label class="ml-2" for="to-has-elevator-checkbox">
                      Sí, cuenta con elevador
                    </label>
                  </div>
                  <p v-if="formValidationMessages['to_has_elevator']"
                    class="text-red-500
                    text-xs
                    italic">
                    {{ formValidationMessages['to_has_elevator'] }}.
                  </p>
                </div>
              </div>
              <div class="md:w-1/2 w-full md:ml-6">
                <SearchBoxPlacesApiGoogle
                  :api-key="placesApiKey"
                  v-on:google-address="fillAddress"
                  input-id="address-to-street"
                  map-id="address-to-map"
                  :initial-address="orderDetailsDestination.to_street"
                />
              </div>
            </div>

            <ViewsMessages :view-name="viewName"/>
            <div class="flex items-center justify-end">
              <button
                :disabled="loading"
                :class="loading?'opacity-50 cursor-not-allowed':''"
                type="button"
                class="bg-green-500
                hover:bg-green-700
                text-white
                py-2
                px-4
                rounded
                focus:outline-none
                focus:border-blue-400"
                @click="nextStep">
                Guardar y continuar
              </button>
            </div>
          </form>
          <Modal :visible="showLeadPhoneModal"
            title="¿Te ayudamos por WhatsApp?"
            @close="skipLeadPhone">
            <p class="text-sm text-gray-600 text-center mb-5">
              Déjanos tu número y te contactamos si necesitas ayuda para terminar tu cotización.
            </p>
            <label class="block text-gray-700 text-sm font-bold mb-2" for="lead-phone">
              Teléfono
            </label>
            <input id="lead-phone"
              v-model="leadPhone"
              type="tel"
              class="appearance-none border rounded w-full py-2 px-3 text-gray-700
              leading-tight focus:outline-none focus:border-blue-400 mb-4"
              placeholder="Ej. 987654321" />
            <button type="button"
              :disabled="loading"
              :class="loading ? 'opacity-50 cursor-not-allowed' : ''"
              class="w-full bg-green-500 hover:bg-green-700 text-white py-2 px-4
              rounded focus:outline-none mb-2"
              @click="submitLeadPhone">
              Continuar
            </button>
            <button type="button"
              class="w-full text-gray-500 text-sm py-1"
              @click="skipLeadPhone">
              Omitir por ahora
            </button>
          </Modal>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState, mapActions, mapMutations } from 'vuex';
import Tracker from '@/components/Tracker.vue';
import ViewsMessages from '@/components/ViewsMessages.vue';
import SearchBoxPlacesApiGoogle from '@/components/SearchBoxPlacesApiGoogle.vue';
import Modal from '@/components/Modal.vue';
import chalan from '../../api/chalan';
import { track } from '../../utils/analytics';
import { tagBlockedStep } from '../../utils/sessionTags';
import steps from '../../store/steps';
import { PARKING_OPTIONS, DEFAULT_PARKING_DISTANCE, formatParkingDistance } from '../../utils/parking';
import { LOAD_TYPES, DEFAULT_LOAD_TYPE } from '../../utils/loadTypes';

// Una carga o un vehículo casi siempre se recoge a nivel de calle: el piso
// arranca en el primero para que no frene a quien no sube escaleras.
const STREET_LEVEL_LOADS = ['cargo', 'vehicle'];
const STREET_LEVEL_FLOOR = 1;

// Number('') es 0, así que vaciar el campo guardaba un cero y el paso quedaba
// "completo" con la casilla en blanco. Vacío es null; el cero solo llega
// cuando el usuario escribe un cero de verdad.
function toNumberOrNull(value) {
  return value === '' || value === null || value === undefined ? null : Number(value);
}

const fieldElementIds = {
  from_street: 'address-from-street',
  from_floor_number: 'address-from-floor',
  from_country: 'address-from-street',
  from_map_url: 'address-from-street',
  from_approximate_distance_from_parking: 'from-parking-distance',
  from_has_elevator: 'from-has-elevator',
  to_street: 'address-to-street',
  to_floor_number: 'address-to-floor',
  to_country: 'address-to-street',
  to_map_url: 'address-to-street',
  to_approximate_distance_from_parking: 'to-parking-distance',
  to_has_elevator: 'to-has-elevator',
};

export default {
  name: 'step-one',
  data() {
    return {
      viewName: 'step-one',
      stepRequisites: {},
      placesApiKey: process.env.VUE_APP_PLACES_API_KEY,
      orderStatusId: {
        pending: 1,
        'in progress': 2,
      },
      showLeadPhoneModal: false,
      leadPhone: null,
      loadTypes: LOAD_TYPES,
    };
  },
  components: {
    Tracker,
    ViewsMessages,
    SearchBoxPlacesApiGoogle,
    Modal,
  },
  mounted() {
    // Antes de buildRequisites, para que el tramo por defecto no cuente como
    // un cambio de dirección.
    if (this.orderDetailsOrigin.from_approximate_distance_from_parking === null) {
      this.fromParkingDistance = DEFAULT_PARKING_DISTANCE;
    }
    if (this.orderDetailsDestination.to_approximate_distance_from_parking === null) {
      this.toParkingDistance = DEFAULT_PARKING_DISTANCE;
    }
    // El widget de la web puede haberlo elegido ya (lo deja en currentOrder).
    this.loadType = this.currentOrder.load_type || DEFAULT_LOAD_TYPE;
    this.buildRequisites();
    track('begin_order');
  },
  props: {
    countryData: Object,
  },
  methods: {
    ...mapActions([
      'validateRequiredFields',
    ]),
    ...mapMutations([
      'setOrder',
      'setFormValidationMessages',
      'setViewsMessages',
      'setLoader',
      'setCustomerData',
    ]),
    // Una orden de antes de los tramos puede traer otro número (35): se suma
    // como opción para no perderlo al volver al paso 1.
    parkingOptions(current) {
      if (current === null || PARKING_OPTIONS.some(o => o.value === current)) {
        return PARKING_OPTIONS;
      }
      return [...PARKING_OPTIONS, { value: current, label: formatParkingDistance(current) }];
    },
    buildRequisites() {
      const {
        'step-one': {
          requisites: requisitesList,
        },
      } = steps;
      const stepOneRequisites = { ...this.orderDetailsOrigin, ...this.orderDetailsDestination };
      requisitesList.forEach((requisite) => {
        this.stepRequisites[requisite] = stepOneRequisites[requisite];
      });
      this.setLoader(false);
    },
    fillAddress(data) {
      const {
        place,
        place: {
          formatted_address: formattedAddress,
          address_components: addressComponents,
          url,
        },
        mapId,
      } = data;
      const direction = mapId.split('-')[1];
      const googleAddress = {};
      Object.keys(addressComponents).forEach((key) => {
        googleAddress[addressComponents[key].types[0]] = addressComponents[key];
      });
      const {
        postal_code: {
          long_name: postalCode,
        } = {},
        country: {
          long_name: country,
        } = {},
        locality: {
          long_name: locality,
        } = {},
        administrative_area_level_2: {
          long_name: province,
        } = {},
        administrative_area_level_1: {
          long_name: state,
        } = {},
      } = googleAddress;
      // Con la ubicación el backoffice le sugiere al admin transportistas de la
      // zona cuando la orden no es de Lima. Las columnas miden 45.
      const location = place.geometry && place.geometry.location;
      const coordinate = value => (typeof value === 'function' ? value.call(location) : value);
      const section = direction === 'from' ? 'orderDetailsOrigin' : 'orderDetailsDestination';
      this.setOrder({ section, field: `${direction}_street`, value: formattedAddress });
      this.setOrder({ section, field: `${direction}_zip_code`, value: postalCode });
      this.setOrder({ section, field: `${direction}_country`, value: country });
      this.setOrder({ section, field: `${direction}_map_url`, value: url });
      this.setOrder({ section, field: `${direction}_city`, value: (locality || province || '').slice(0, 45) || null });
      this.setOrder({ section, field: `${direction}_state`, value: (state || '').slice(0, 45) || null });
      this.setOrder({ section, field: `${direction}_latitude`, value: location ? coordinate(location.lat) : null });
      this.setOrder({ section, field: `${direction}_longitude`, value: location ? coordinate(location.lng) : null });
    },
    removeSelectedProduct() {
      const productFields = {
        vehicle_id: null,
        price: null,
      };
      Object.keys(productFields).forEach((field) => {
        this.setOrder({ section: 'currentOrder', field, value: '' });
      });
    },
    missingFields() {
      return this.steps[this.viewName].requisites
        .filter(field => this.formValidationMessages[field]);
    },
    scrollToFirstMissingField() {
      const [firstMissingField] = this.missingFields();
      const elementId = fieldElementIds[firstMissingField];
      const element = elementId && document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (typeof element.focus === 'function') {
          element.focus({ preventScroll: true });
        }
      }
    },
    nextStep() {
      this.validateRequiredFields(this.viewName);
      if (this.steps[this.viewName].isComplete) {
        this.setOrder({ section: 'currentOrder', field: 'created_date', value: this.$moment().format() });
        this.setLoader(true);
        if (!this.isSameAddress) {
          this.removeSelectedProduct();
        }
        if (!this.currentOrder.order_id) {
          const referralCode = document.cookie.split('; ')
            .find(c => c.startsWith('chalan_ref='))?.split('=')[1] || null;
          const payload = {
            order: this.currentOrder,
            orderDetailsOrigin: this.orderDetailsOrigin,
            orderDetailsDestination: this.orderDetailsDestination,
            services: this.services,
            customer: this.customer,
            referral_code: referralCode,
          };
          chalan.createOrder(payload)
            .then((response) => {
              if (response.status === 201) {
                this.setOrder({ section: 'currentOrder', field: 'order_id', value: response.data.order_id });
                this.setOrder({ section: 'currentOrder', field: 'order_status_id', value: this.orderStatusId.pending });
                track('order_created', {
                  order_id: response.data.order_id,
                  ref_code: referralCode,
                  load_type: this.loadType,
                });
                this.proceedToStepTwo();
              }
            })
            .catch(() => {
              this.setViewsMessages({
                view: this.viewName,
                message: {
                  type: 'error',
                  text: 'Hubo un error, intenta después de recargar la página',
                },
              });
              this.setLoader(false);
            });
        } else {
          const payload = {
            order: this.currentOrder,
            orderDetailsOrigin: this.orderDetailsOrigin,
            orderDetailsDestination: this.orderDetailsDestination,
            services: this.services,
            customer: this.customer,
            // Marca el único caso en que el cliente cambió de verdad lo que
            // hay que mudar. Sin esto el backend cancelaba las cotizaciones
            // también cuando el PUT venía del login, que solo reenvía lo que
            // quedó guardado en el navegador.
            orderEditedByCustomer: true,
          };
          chalan.updateOrder(payload)
            .then((response) => {
              if (response.status === 200) {
                this.proceedToStepTwo();
              }
            })
            .catch(() => {
              this.setViewsMessages({
                view: this.viewName,
                message: {
                  type: 'error',
                  text: 'Hubo un error, intenta después de recargar la página',
                },
              });
              this.setLoader(false);
            });
        }
      } else {
        // Al usuario le pasa que da clic en "continuar" y la página no se
        // mueve: la validación solo pinta mensajes inline. Mandamos el primer
        // campo que bloquea (el mismo que enfoca el scroll) porque es el que
        // realmente lo detiene, y solo ese: los parámetros de GA4 se cortan a
        // 100 caracteres y la lista completa no cabe. Nombres de campo, nunca
        // sus valores.
        const missing = this.missingFields();
        track('step_one_blocked', {
          missing_field: missing[0],
          missing_count: missing.length,
          load_type: this.loadType,
        });
        tagBlockedStep('step_one', missing[0]);
        this.scrollToFirstMissingField();
      }
    },
    proceedToStepTwo() {
      if (this.shouldPromptForLeadPhone) {
        this.setLoader(false);
        this.showLeadPhoneModal = true;
        track('lead_phone_prompted', { order_id: this.currentOrder.order_id });
        return;
      }
      this.$router.push({ name: 'step-two' }).catch(() => {});
    },
    // Cerrar y seguir, sin evento. submitLeadPhone y skipLeadPhone comparten
    // este paso: si el tracking viviera aquí, cada envío exitoso dispararía
    // también lead_phone_skipped y la tasa de omisión saldría siempre al 100%.
    closeLeadPhoneModal() {
      this.setOrder({ section: 'currentOrder', field: 'lead_phone_prompted', value: true });
      this.showLeadPhoneModal = false;
      this.$router.push({ name: 'step-two' }).catch(() => {});
    },
    skipLeadPhone() {
      track('lead_phone_skipped', { order_id: this.currentOrder.order_id });
      this.closeLeadPhoneModal();
    },
    submitLeadPhone() {
      if (this.leadPhone) {
        this.setCustomerData({ field: 'mobile_phone', value: this.leadPhone });
        chalan.saveLeadPhone({
          orderId: this.currentOrder.order_id,
          leadPhone: this.leadPhone,
        }).catch(() => {});
        // El número nunca se manda a GA, solo el hecho de que lo dejó.
        track('lead_phone_submitted', { order_id: this.currentOrder.order_id });
      } else {
        // "Continuar" con el campo vacío se comporta igual que omitir, y así
        // prompted == submitted + skipped siempre cuadra.
        track('lead_phone_skipped', { order_id: this.currentOrder.order_id });
      }
      this.closeLeadPhoneModal();
    },
  },
  computed: {
    ...mapState([
      'currentOrder',
      'orderDetailsOrigin',
      'orderDetailsDestination',
      'services',
      'customer',
      'formValidationMessages',
      'viewsMessages',
      'steps',
      'loading',
    ]),
    isSameAddress() {
      const stepOneRequisites = { ...this.orderDetailsOrigin, ...this.orderDetailsDestination };
      return Object.keys(this.stepRequisites)
        .reduce((prev, curr) => prev
          && (stepOneRequisites[curr] === this.stepRequisites[curr]), true);
    },
    loadType: {
      get() {
        return this.currentOrder.load_type;
      },
      set(value) {
        this.setOrder({ section: 'currentOrder', field: 'load_type', value });
        if (STREET_LEVEL_LOADS.includes(value)) {
          if (this.selectedFromFloor === null) this.selectedFromFloor = STREET_LEVEL_FLOOR;
          if (this.selectedToFloor === null) this.selectedToFloor = STREET_LEVEL_FLOOR;
        }
      },
    },
    floorLabel() {
      return STREET_LEVEL_LOADS.includes(this.loadType) ? 'Piso' : 'Piso de la vivienda';
    },
    shouldPromptForLeadPhone() {
      return !this.customer.customer_id
        && !this.customer.mobile_phone
        && !this.currentOrder.lead_phone_prompted;
    },
    selectedFromStreet: {
      get() {
        return this.orderDetailsOrigin.from_street;
      },
      set(value) {
        this.setOrder({ section: 'orderDetailsOrigin', field: 'from_street', value });
      },
    },
    selectedToStreet: {
      get() {
        return this.orderDetailsDestination.to_street;
      },
      set(value) {
        this.setOrder({ section: 'orderDetailsDestination', field: 'to_street', value });
      },
    },
    selectedFromFloor: {
      get() {
        return this.orderDetailsOrigin.from_floor_number;
      },
      set(value) {
        this.setOrder({ section: 'orderDetailsOrigin', field: 'from_floor_number', value: toNumberOrNull(value) });
      },
    },
    selectedToFloor: {
      get() {
        return this.orderDetailsDestination.to_floor_number;
      },
      set(value) {
        this.setOrder({ section: 'orderDetailsDestination', field: 'to_floor_number', value: toNumberOrNull(value) });
      },
    },
    fromParkingDistance: {
      get() {
        return this.orderDetailsOrigin.from_approximate_distance_from_parking;
      },
      set(value) {
        this.setOrder({ section: 'orderDetailsOrigin', field: 'from_approximate_distance_from_parking', value: toNumberOrNull(value) });
      },
    },
    toParkingDistance: {
      get() {
        return this.orderDetailsDestination.to_approximate_distance_from_parking;
      },
      set(value) {
        this.setOrder({ section: 'orderDetailsDestination', field: 'to_approximate_distance_from_parking', value: toNumberOrNull(value) });
      },
    },
    fromHasElevator: {
      get() {
        return this.orderDetailsOrigin.from_has_elevator;
      },
      set(value) {
        this.setOrder({ section: 'orderDetailsOrigin', field: 'from_has_elevator', value });
      },
    },
    toHasElevator: {
      get() {
        return this.orderDetailsDestination.to_has_elevator;
      },
      set(value) {
        this.setOrder({ section: 'orderDetailsDestination', field: 'to_has_elevator', value });
      },
    },
  },
};
</script>
