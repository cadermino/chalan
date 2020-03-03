<template>
  <div>
    <div class="flex flex-wrap">
      <div class="w-full mb-4">
        <Tracker :current-view="viewName"></Tracker>
        <div class="w-full max-w-xl mx-auto sm:p-0 p-5 sm:pb-8">
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
          <p class="text-center font-bold mb-10" id="text-header">
            Elige el tamaño de tu mudanza <span class="text-red-500">*</span>
          </p>
          <div class="flex flex-wrap mb-4">
            <div v-for="(vehicle, index) in vehiclesAvailable"
              v-bind:value="index"
              v-bind:key="index"
              class="w-full my-5">
              <div @click="(currentOrder.driver_id == vehicle.driver_id) ?
                        '' : selectSize(vehicle)"
                :class="(currentOrder.driver_id == vehicle.driver_id) ? 'bg-gray-200' : ''"
                class="w-full lg:max-w-full lg:flex">
                <div class="h-48
                  lg:h-auto lg:w-48
                  flex-none
                  bg-cover
                  border-l border-r border-b-0 border-t border-gray-400
                  lg:border-r-0
                  lg:border-b
                  rounded-t
                  lg:rounded-t-none lg:rounded-l
                  text-center
                  overflow-hidden"
                  :style="{ backgroundImage:
                  'url(' + require('@/assets/'+vehicle.bgImage) + ')'}"
                  style="background-size: 60%;
                  background-position: center;
                  background-repeat: no-repeat;"
                  title="Woman holding a mug">
                </div>
                <div class="w-full border-r
                  border-b
                  border-l
                  border-gray-400
                  lg:border-l-0
                  lg:border-t
                  lg:border-gray-400
                  rounded-b
                  lg:rounded-b-none
                  lg:rounded-r
                  p-4
                  flex
                  flex-col
                  justify-between
                  leading-normal">
                  <div class="mb-8">
                    <div class="text-gray-900 font-bold text-xl mb-2">
                      {{ vehicle.title }}
                    </div>
                    <p class="text-gray-700 text-base">
                      {{ vehicle.description }}
                    </p>
                  </div>
                  <div class="flex items-center">
                    <button
                      type="button"
                      :class="(currentOrder.driver_id == vehicle.driver_id) ?
                        'opacity-50 cursor-not-allowed bg-gray-600 hover:bg-gray-700' :
                        'bg-green-500 hover:bg-green-700'"
                      class="w-full
                      text-white
                      py-2
                      px-4
                      rounded
                      focus:outline-none
                      focus:border-blue-400">
                      {{ (currentOrder.driver_id == vehicle.driver_id) ?
                        'Seleccionado' : 'Elegir' }}
                    </button>
                  </div>
                </div>
              </div>
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
          <div class="flex items-center justify-between">
            <router-link to="/order/step-one" class="bg-green-500
              hover:bg-green-700
              text-white
              py-2
              px-4
              rounded
              focus:outline-none
              focus:border-blue-400">
              Atras
            </router-link>
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
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState, mapActions, mapMutations } from 'vuex';
// @ is an alias to /src
import Tracker from '@/components/Tracker.vue';
import chalan from '../../api/chalan';

export default {
  name: 'step-two',
  data() {
    return {
      viewName: 'step-two',
      vehiclesAvailable: {},
      vehiclesInfo: {
        small: {
          bgImage: 'truck-small.svg',
          title: 'Pequeño',
          description: 'Vehiculo con capacidad para uno a dos muebles',
        },
        medium: {
          bgImage: 'truck-medium.svg',
          title: 'Mediano',
          description: 'Capacidad de 5 a 10 muebles',
        },
        large: {
          bgImage: 'truck-large.svg',
          title: 'Grande',
          description: 'Capacidad para una mudanza completa',
        },
      },
    };
  },
  components: {
    Tracker,
  },
  mounted() {
    this.getDataFromLocalStorage();
    if (!this.steps['step-one'].isComplete) {
      this.$router.push('step-one');
    }
    this.getAvailableVehicles();
    document.getElementById('text-header').scrollIntoView();
  },
  props: [
  ],
  methods: {
    ...mapActions([
      'validateRequiredFields',
      'getDataFromLocalStorage',
    ]),
    ...mapMutations([
      'setOrder',
      'setViewsMessages',
    ]),
    nextStep() {
      console.log(this.steps[this.viewName].isComplete);
      // this.validateRequiredFields(this.viewName);
      if (this.steps[this.viewName].isComplete) {
        const parsed = JSON.stringify(this.currentOrder);
        localStorage.setItem('currentOrder', parsed);
        this.$router.push('step-three');
      }
    },
    selectSize(vehicle) {
      this.setOrder({ field: 'driver_id', value: String(vehicle.driver_id) });
    },
    getAvailableVehicles() {
      chalan.getAvailableVehicles()
        .then((response) => {
          this.vehiclesAvailable = response.data;
          Object.values(this.vehiclesAvailable).forEach((value) => {
            this.vehiclesAvailable[value.size]
              .bgImage = this.vehiclesInfo[value.size].bgImage;
            this.vehiclesAvailable[value.size]
              .title = this.vehiclesInfo[value.size].title;
            this.vehiclesAvailable[value.size]
              .description = this.vehiclesInfo[value.size].description;
          });
        })
        .catch(() => {
          this.setViewsMessages({
            view: 'step-two',
            message: 'Hubo un error, intenta después de recargar la página',
          });
        });
    },
  },
  computed: {
    ...mapState([
      'currentOrder',
      'formValidationMessages',
      'steps',
      'viewsMessages',
    ]),
  },
};
</script>
