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
                  font-bold mb-2" for="address-from-interior">
                      Número interior
                  </label>
                  <input class="appearance-none
                  border rounded
                  w-full
                  py-2
                  px-3
                  text-gray-700
                  leading-tight
                  focus:outline-none
                  focus:border-blue-400"
                  v-model="selectedFromInteriorNumber"
                  id="address-from-interior"
                  placeholder="Ejem: 204"
                  type="text">
                </div>
                <div class="w-full md:w-1/2 px-3 mb-4">
                  <label class="block
                  text-gray-700
                  text-sm
                  font-bold mb-2" for="address-from-floor">
                      Piso de la vivienda <span class="text-red-500">*</span>
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
                      v-for="(item, index) in countryData.floor"
                      v-bind:value="index"
                      v-bind:key="index">
                        {{ item }}
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
                      Distancia aproximanada al estacionamiento<span class="text-red-500">*</span>
                      <span class="font-normal text-xs"> (mts.)</span>
                  </label>
                  <input :class="formValidationMessages['from_approximate_distance_from_parking']
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
                    @wheel="$event.target.blur()"
                    v-model="fromParkingDistance"
                    id="from-parking-distance"
                    type="number"
                    min="0"
                    placeholder="Ej. 5"
                    >
                    <p v-if="formValidationMessages['from_approximate_distance_from_parking']"
                      class="text-red-500
                      text-xs
                      italic">
                      {{ formValidationMessages['from_approximate_distance_from_parking'] }}.
                    </p>
                </div>
                <div class="w-full md:w-1/2 px-3 mb-4">
                  <label class="block
                    text-gray-700
                    text-sm
                    font-bold mb-6">
                      El edificio cuenta con elevador? <span class="text-red-500">*</span>
                  </label>
                  <div>
                    <input type="radio"
                      id="from-has-elevator-1"
                      name="from-has-elevator-1"
                      v-model="fromHasElevator"
                      :value="'1'" />
                    <label class="ml-2" for="from-has-elevator-1">Sí</label>
                  </div>
                  <div>
                    <input type="radio"
                      id="from-has-elevator-0"
                      name="from-has-elevator-0"
                      v-model="fromHasElevator"
                      :value="'0'" />
                    <label class="ml-2" for="from-has-elevator-0">No</label>
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
                  font-bold mb-2" for="address-to-interior">
                      Número interior
                  </label>
                  <input class="appearance-none
                  border rounded
                  w-full
                  py-2
                  px-3
                  text-gray-700
                  leading-tight
                  focus:outline-none
                  focus:border-blue-400"
                  v-model="selectedToInteriorNumber"
                  id="address-to-interior"
                  placeholder="Ejem: 204"
                  type="text">
                </div>
                <div class="w-full md:w-1/2 px-3 mb-4">
                  <label class="block
                  text-gray-700
                  text-sm
                  font-bold mb-2" for="address-to-floor">
                      Piso de la vivienda <span class="text-red-500">*</span>
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
                      v-for="(item, index) in countryData.floor"
                      v-bind:value="index"
                      v-bind:key="index">
                        {{ item }}
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
                      Distancia aproximanada al estacionamiento<span class="text-red-500">*</span>
                      <span class="font-normal text-xs"> (mts.)</span>
                  </label>
                  <input :class="formValidationMessages['to_approximate_distance_from_parking']
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
                    @wheel="$event.target.blur()"
                    v-model="toParkingDistance"
                    id="to-parking-distance"
                    type="number"
                    min="0"
                    placeholder="Ej. 5"
                    >
                    <p v-if="formValidationMessages['to_approximate_distance_from_parking']"
                      class="text-red-500
                      text-xs
                      italic">
                      {{ formValidationMessages['to_approximate_distance_from_parking'] }}.
                    </p>
                </div>
                <div class="w-full md:w-1/2 px-3 mb-4">
                  <label class="block
                    text-gray-700
                    text-sm
                    font-bold mb-6">
                      El edificio cuenta con elevador? <span class="text-red-500">*</span>
                  </label>
                  <div>
                    <input type="radio"
                      id="to-has-elevator-1"
                      name="to-has-elevator-1"
                      v-model="toHasElevator"
                      :value="'1'" />
                    <label class="ml-2" for="to-has-elevator-1">Sí</label>
                  </div>
                  <div>
                    <input type="radio"
                      id="to-has-elevator-0"
                      name="to-has-elevator-0"
                      v-model="toHasElevator"
                      :value="'0'" />
                    <label class="ml-2" for="to-has-elevator-0">No</label>
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
import chalan from '../../api/chalan';
import steps from '../../store/steps';

export default {
  name: 'step-one',
  data() {
    return {
      viewName: 'step-one',
      stepRequisites: {},
      selectedFromStreet: '',
      selectedToStreet: '',
      placesApiKey: process.env.VUE_APP_PLACES_API_KEY,
      orderStatusId: {
        pending: 1,
        'in progress': 2,
      },
    };
  },
  components: {
    Tracker,
    ViewsMessages,
    SearchBoxPlacesApiGoogle,
  },
  mounted() {
    this.selectedFromStreet = this.orderDetailsOrigin.from_street;
    this.selectedToStreet = this.orderDetailsDestination.to_street;
    this.buildRequisites();
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
    ]),
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
      } = googleAddress;
      const section = direction === 'from' ? 'orderDetailsOrigin' : 'orderDetailsDestination';
      this.setOrder({ section, field: `${direction}_street`, value: formattedAddress });
      this.setOrder({ section, field: `${direction}_zip_code`, value: postalCode });
      this.setOrder({ section, field: `${direction}_country`, value: country });
      this.setOrder({ section, field: `${direction}_map_url`, value: url });
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
    nextStep() {
      this.validateRequiredFields(this.viewName);
      if (this.steps[this.viewName].isComplete) {
        this.setOrder({ section: 'currentOrder', field: 'created_date', value: this.$moment().format() });
        this.setLoader(true);
        if (!this.isSameAddress) {
          this.removeSelectedProduct();
        }
        if (!this.currentOrder.order_id) {
          const payload = {
            order: this.currentOrder,
            orderDetailsOrigin: this.orderDetailsOrigin,
            orderDetailsDestination: this.orderDetailsDestination,
            services: this.services,
            customer: this.customer,
          };
          chalan.createOrder(payload)
            .then((response) => {
              if (response.status === 201) {
                this.setOrder({ section: 'currentOrder', field: 'order_id', value: response.data.order_id });
                this.setOrder({ section: 'currentOrder', field: 'order_status_id', value: this.orderStatusId.pending });
                this.$router.push({
                  name: this.steps[this.viewName].next,
                });
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
          };
          chalan.updateOrder(payload)
            .then((response) => {
              if (response.status === 200) {
                this.$router.push({
                  name: 'step-two',
                });
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
      }
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
    selectedFromInteriorNumber: {
      get() {
        return this.orderDetailsOrigin.from_interior_number;
      },
      set(value) {
        this.setOrder({ section: 'orderDetailsOrigin', field: 'from_interior_number', value });
      },
    },
    selectedFromFloor: {
      get() {
        return this.orderDetailsOrigin.from_floor_number;
      },
      set(value) {
        this.setOrder({ section: 'orderDetailsOrigin', field: 'from_floor_number', value: Number(value) });
      },
    },
    selectedToInteriorNumber: {
      get() {
        return this.orderDetailsDestination.to_interior_number;
      },
      set(value) {
        this.setOrder({ section: 'orderDetailsDestination', field: 'to_interior_number', value });
      },
    },
    selectedToFloor: {
      get() {
        return this.orderDetailsDestination.to_floor_number;
      },
      set(value) {
        this.setOrder({ section: 'orderDetailsDestination', field: 'to_floor_number', value: Number(value) });
      },
    },
    fromParkingDistance: {
      get() {
        return this.orderDetailsOrigin.from_approximate_distance_from_parking;
      },
      set(value) {
        this.setOrder({ section: 'orderDetailsOrigin', field: 'from_approximate_distance_from_parking', value: Number(value) });
      },
    },
    toParkingDistance: {
      get() {
        return this.orderDetailsDestination.to_approximate_distance_from_parking;
      },
      set(value) {
        this.setOrder({ section: 'orderDetailsDestination', field: 'to_approximate_distance_from_parking', value: Number(value) });
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
