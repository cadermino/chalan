<template>
    <div>
        <div class="flex flex-wrap">
            <div class="w-full mb-4">
                <Tracker></Tracker>
                <div class="w-full max-w-xl mx-auto">
                    <form class="bg-white px-8 pt-6 pb-8 mb-4">
                        <div class="flex items-center mb-8">
                          <div v-if="viewsMessages[viewName]"
                            class="bg-red-100
                            w-full
                            border
                            border-red-400
                            text-red-700
                            px-4
                            py-3
                            rounded
                            relative"
                            role="alert">
                            <strong class="font-bold">Oops! </strong>
                            <span class="block sm:inline">
                              {{ viewsMessages[viewName] }}
                            </span>
                          </div>
                        </div>
                        <p class="text-center font-bold mb-10">Dirección de inicial</p>
                        <div class="flex flex-wrap -mx-3 mb-4">
                          <div class="w-full px-3 mb-4">
                              <label class="block
                                text-gray-700
                                text-sm
                                font-bold mb-2" for="address-from-street">
                                    Calle <span class="text-red-500">*</span>
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
                                placeholder="Ejem: Londres 198"
                                type="text">
                              <p v-if="formValidationMessages['from_street']"
                                class="text-red-500
                                text-xs
                                italic">{{ formValidationMessages['from_street'] }}.</p>
                          </div>
                          <div class="w-full md:w-1/3 px-3 mb-4">
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
                          <div class="w-full md:w-1/3 px-3 mb-4">
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
                                v-for="(item, index) in floorList"
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
                          <div class="w-full md:w-1/3 px-3 mb-4">
                            <label class="block
                            text-gray-700
                            text-sm
                            font-bold mb-2" for="address-from-zipcode">
                                Código postal <span class="text-red-500">*</span>
                            </label>
                            <input :class="formValidationMessages['from_zip_code']
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
                            v-model="zipcodeFrom"
                            id="address-from-zipcode"
                            type="number">
                            <p v-if="formValidationMessages['from_zip_code']"
                            class="text-red-500
                            text-xs
                            italic">{{ formValidationMessages['from_zip_code'] }}.</p>
                          </div>
                          <div class="w-full md:w-1/3 px-3 mb-4">
                            <label class="block
                            text-gray-700
                            text-sm
                            font-bold mb-2" for="address-from-neighborhood">
                                Colonia <span class="text-red-500">*</span>
                            </label>
                            <div class="relative">
                              <select
                              :class="formValidationMessages['from_neighborhood']
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
                              id="address-from-neighborhood"
                              v-model="selectedFromNeighborhood">
                                <option disabled value="">Selecciona una colonia</option>
                                <option
                                v-for="item in fromNeighborhoodList"
                                v-bind:value="item.asentamiento"
                                v-bind:key="item.asentamiento">
                                  {{ item.asentamiento }}
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
                              <p v-if="formValidationMessages['from_neighborhood']"
                                class="text-red-500
                                text-xs
                                italic">
                                {{ formValidationMessages['from_neighborhood'] }}
                              </p>
                            </div>
                          </div>
                          <div class="w-full md:w-1/3 px-3 mb-4">
                            <label class="block
                            text-gray-700
                            text-sm
                            font-bold mb-2" for="address-from-city">
                                Alcaldía/Municipio <span class="text-red-500">*</span>
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
                              disabled
                              id="address-from-city"
                              :value="currentOrder.from_city"
                              type="text">
                          </div>
                          <div class="w-full md:w-1/3 px-3 mb-4">
                            <label class="block
                            text-gray-700
                            text-sm
                            font-bold mb-2" for="address-from-state">
                                Estado <span class="text-red-500">*</span>
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
                                  disabled
                                  id="address-from-state"
                                  :value="currentOrder.from_state"
                                  type="text">
                          </div>
                        </div>
                        <div class="border-b border-1 my-10"></div>
                        <p class="text-center font-bold mb-10">Dirección de destino</p>

                        <div class="flex flex-wrap -mx-3 mb-4">
                          <div class="w-full px-3 mb-4">
                              <label class="block
                                text-gray-700
                                text-sm
                                font-bold mb-2" for="address-to-street">
                                    Calle <span class="text-red-500">*</span>
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
                                placeholder="Ejem: Londres 198"
                                type="text">
                              <p v-if="formValidationMessages['to_street']"
                                class="text-red-500
                                text-xs
                                italic">{{ formValidationMessages['to_street'] }}.</p>
                          </div>
                          <div class="w-full md:w-1/3 px-3 mb-4">
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
                          <div class="w-full md:w-1/3 px-3 mb-4">
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
                                v-for="(item, index) in floorList"
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
                          <div class="w-full md:w-1/3 px-3 mb-4">
                            <label class="block
                            text-gray-700
                            text-sm
                            font-bold mb-2" for="address-to-zipcode">
                                Código postal <span class="text-red-500">*</span>
                            </label>
                            <input :class="formValidationMessages['to_zip_code']
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
                            v-model="zipcodeTo"
                            id="address-to-zipcode"
                            type="number">
                            <p v-if="formValidationMessages['to_zip_code']"
                            class="text-red-500
                            text-xs
                            italic">{{ formValidationMessages['to_zip_code'] }}.</p>
                          </div>
                          <div class="w-full md:w-1/3 px-3 mb-4">
                            <label class="block
                            text-gray-700
                            text-sm
                            font-bold mb-2" for="address-to-neighborhood">
                                Colonia <span class="text-red-500">*</span>
                            </label>
                            <div class="relative">
                              <select
                              :class="formValidationMessages['to_neighborhood']
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
                              id="address-to-neighborhood"
                              v-model="selectedToNeighborhood">
                                <option disabled value="">Selecciona una colonia</option>
                                <option
                                v-for="item in toNeighborhoodList"
                                v-bind:value="item.asentamiento"
                                v-bind:key="item.asentamiento">
                                  {{ item.asentamiento }}
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
                              <p v-if="formValidationMessages['to_neighborhood']"
                                class="text-red-500
                                text-xs
                                italic">
                                {{ formValidationMessages['to_neighborhood'] }}
                              </p>
                            </div>
                          </div>
                          <div class="w-full md:w-1/3 px-3 mb-4">
                            <label class="block
                            text-gray-700
                            text-sm
                            font-bold mb-2" for="address-to-city">
                                Alcaldía/Municipio <span class="text-red-500">*</span>
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
                              disabled
                              id="address-to-city"
                              :value="currentOrder.to_city"
                              type="text">
                          </div>
                          <div class="w-full md:w-1/3 px-3 mb-4">
                            <label class="block
                            text-gray-700
                            text-sm
                            font-bold mb-2" for="address-to-state">
                                Estado <span class="text-red-500">*</span>
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
                                  disabled
                                  id="address-to-state"
                                  :value="currentOrder.to_state"
                                  type="text">
                          </div>
                        </div>

                        <div class="flex items-center mb-8">
                          <div v-if="viewsMessages[viewName]"
                            class="bg-red-100
                            w-full
                            border
                            border-red-400
                            text-red-700
                            px-4
                            py-3
                            rounded
                            relative"
                            role="alert">
                            <strong class="font-bold">Oops! </strong>
                            <span class="block sm:inline">
                              {{ viewsMessages[viewName] }}
                            </span>
                          </div>
                        </div>
                        <div class="flex items-center justify-end">
                          <button
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
                            Siguiente
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
// @ is an alias to /src
import Tracker from '@/components/Tracker.vue';

export default {
  name: 'step-one',
  data() {
    return {
      viewName: 'step-one',
      floorList: ['Planta baja', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
    };
  },
  components: {
    Tracker,
  },
  mounted() {},
  props: [
  ],
  methods: {
    ...mapActions([
      'getAddress',
      'validateRequiredFields',
    ]),
    ...mapMutations([
      'setOrder',
      'setMessage',
      'fillNeighborhoodList',
      'setFormValidationMessages',
      'setViewsMessages',
    ]),
    nextStep() {
      this.validateRequiredFields(this.viewName);
      if (this.steps[this.viewName].isComplete) {
        this.$router.push('step-two');
      }
    },
  },
  computed: {
    ...mapState([
      'currentOrder',
      'fromNeighborhoodList',
      'toNeighborhoodList',
      'messages',
      'formValidationMessages',
      'viewsMessages',
      'steps',
    ]),
    zipcodeFrom: {
      get() {
        return this.currentOrder.from_zip_code;
      },
      set(zipcode) {
        this.setOrder({ value: zipcode, field: 'from_zip_code' });
        this.selectedFromNeighborhood = null;
        this.fillNeighborhoodList({ value: [], direction: 'from' });
        if (zipcode.length > 3 && zipcode.length < 6) {
          this.getAddress({ zipcode, direction: 'from' });
        } else {
          this.setFormValidationMessages({ field: 'from_zip_code', message: 'ingresa un código postal válido' });
        }
      },
    },
    selectedFromStreet: {
      get() {
        return this.currentOrder.from_street;
      },
      set(value) {
        this.setOrder({ field: 'from_street', value });
      },
    },
    selectedFromInteriorNumber: {
      get() {
        return this.currentOrder.from_interior_number;
      },
      set(value) {
        this.setOrder({ field: 'from_interior_number', value });
      },
    },
    selectedFromNeighborhood: {
      get() {
        return this.currentOrder.from_neighborhood;
      },
      set(value) {
        this.setOrder({ field: 'from_neighborhood', value });
      },
    },
    selectedFromFloor: {
      get() {
        return this.currentOrder.from_floor_number;
      },
      set(value) {
        this.setOrder({ field: 'from_floor_number', value: String(value) });
      },
    },
    zipcodeTo: {
      get() {
        return this.currentOrder.to_zip_code;
      },
      set(zipcode) {
        this.setOrder({ value: zipcode, field: 'to_zip_code' });
        this.selectedToNeighborhood = null;
        this.fillNeighborhoodList({ value: [], direction: 'to' });
        if (zipcode.length > 3 && zipcode.length < 6) {
          this.getAddress({ zipcode, direction: 'to' });
        } else {
          this.setFormValidationMessages({ field: 'to_zip_code', message: 'ingresa un código postal válido' });
        }
      },
    },
    selectedToStreet: {
      get() {
        return this.currentOrder.to_street;
      },
      set(value) {
        this.setOrder({ field: 'to_street', value });
      },
    },
    selectedToInteriorNumber: {
      get() {
        return this.currentOrder.to_interior_number;
      },
      set(value) {
        this.setOrder({ field: 'to_interior_number', value });
      },
    },
    selectedToNeighborhood: {
      get() {
        return this.currentOrder.to_neighborhood;
      },
      set(value) {
        this.setOrder({ field: 'to_neighborhood', value });
      },
    },
    selectedToFloor: {
      get() {
        return this.currentOrder.to_floor_number;
      },
      set(value) {
        this.setOrder({ field: 'to_floor_number', value: String(value) });
      },
    },
  },
};
</script>
